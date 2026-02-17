/**
 * UPDATE_PANEL command
 *
 * Update properties of an existing panel. Supports partial updates --
 * only the fields provided in the payload are changed.
 *
 * Merge behaviour:
 *   - options and fieldConfig.defaults are deep-merged with existing values.
 *   - queries, transformations, and fieldConfig.overrides are replaced wholesale.
 *   - title, description, transparent are set directly.
 *   - Changing vizConfig.group (plugin type) calls changePluginType() which
 *     loads the new plugin and migrates options/fieldConfig with proper defaults.
 */

import { z } from 'zod';

import { SceneDataTransformer, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import type { FieldConfigSource, PanelQueryKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { DashboardScene } from '../../scene/DashboardScene';
import { panelQueryKindToSceneQuery } from '../../serialization/layoutSerializers/utils';
import { transformMappingsToV1 } from '../../serialization/transformToV1TypesUtils';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const updatePanelPayloadSchema = payloads.updatePanel;

export type UpdatePanelPayload = z.infer<typeof updatePanelPayloadSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Safely coerce an arbitrary value to Record<string, unknown>. */
function toRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }
  return {};
}

/**
 * Deep-merge `source` into `target`, replacing arrays wholesale.
 * Returns a new object (does not mutate inputs).
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];
    if (isRecord(srcVal) && isRecord(tgtVal)) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * Apply partial updates to a VizPanel's metadata and vizConfig.
 * options and fieldConfig.defaults are deep-merged; other fields are replaced.
 *
 * When vizConfig.group changes (plugin type change), we call changePluginType()
 * which properly loads the new plugin and migrates options/fieldConfig. If
 * options or fieldConfig are also provided, they are merged on top *after*
 * the plugin change.
 */
async function applyPanelUpdates(
  vizPanel: VizPanel,
  updates: UpdatePanelPayload['panel']
): Promise<{ previousValue: Record<string, unknown>; newValue: Record<string, unknown> }> {
  const previous: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  const stateUpdates: Record<string, unknown> = {};

  if (updates.title !== undefined) {
    previous.title = vizPanel.state.title;
    next.title = updates.title;
    stateUpdates.title = updates.title;
    stateUpdates.hoverHeader = !updates.title;
  }

  if (updates.description !== undefined) {
    previous.description = vizPanel.state.description;
    next.description = updates.description;
    stateUpdates.description = updates.description;
  }

  if (updates.transparent !== undefined) {
    previous.transparent = vizPanel.state.displayMode === 'transparent';
    next.transparent = updates.transparent;
    stateUpdates.displayMode = updates.transparent ? 'transparent' : 'default';
  }

  // Apply non-vizConfig state updates first
  if (Object.keys(stateUpdates).length > 0) {
    vizPanel.setState(stateUpdates);
  }

  if (updates.vizConfig) {
    const isPluginChange =
      updates.vizConfig.group !== undefined && updates.vizConfig.group !== vizPanel.state.pluginId;

    if (isPluginChange) {
      previous.pluginId = vizPanel.state.pluginId;
      next.pluginId = updates.vizConfig.group;

      // changePluginType loads the new plugin and migrates options/fieldConfig.
      // Pass initial options/fieldConfig if provided so they're applied with
      // the new plugin's defaults rather than merged on stale state.
      await vizPanel.changePluginType(
        updates.vizConfig.group!,
        updates.vizConfig.spec?.options ? toRecord(updates.vizConfig.spec.options) : undefined,
        updates.vizConfig.spec?.fieldConfig
          ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structurally compatible
            ({
              defaults: toRecord(updates.vizConfig.spec.fieldConfig.defaults ?? {}),
              overrides: updates.vizConfig.spec.fieldConfig.overrides ?? [],
            } as unknown as import('@grafana/data').FieldConfigSource)
          : undefined
      );

      // After changePluginType, options/fieldConfig have been applied with
      // the new plugin's defaults. If options or fieldConfig were provided,
      // merge them on top of the post-change state for completeness.
      if (updates.vizConfig.spec?.options) {
        previous.options = vizPanel.state.options;
        const merged = deepMerge(toRecord(vizPanel.state.options ?? {}), toRecord(updates.vizConfig.spec.options));
        vizPanel.onOptionsChange(merged, true);
        next.options = merged;
      }
      if (updates.vizConfig.spec?.fieldConfig) {
        previous.fieldConfig = vizPanel.state.fieldConfig;
        const currentFieldConfig = toRecord(vizPanel.state.fieldConfig ?? {});
        const currentDefaults = toRecord(currentFieldConfig.defaults ?? {});
        const newDefaults = updates.vizConfig.spec.fieldConfig.defaults
          ? deepMerge(currentDefaults, toRecord(updates.vizConfig.spec.fieldConfig.defaults))
          : currentDefaults;
        const currentOverrides = Array.isArray(currentFieldConfig.overrides) ? currentFieldConfig.overrides : [];
        const newOverrides = updates.vizConfig.spec.fieldConfig.overrides ?? currentOverrides;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structurally compatible
        const fieldConfig = {
          defaults: newDefaults,
          overrides: newOverrides,
        } as unknown as import('@grafana/data').FieldConfigSource;
        vizPanel.onFieldConfigChange(fieldConfig, true);
        next.fieldConfig = fieldConfig;
      }
    } else {
      // No plugin change -- apply vizConfig fields via setState + merge
      const vizStateUpdates: Record<string, unknown> = {};

      if (updates.vizConfig.group !== undefined) {
        previous.pluginId = vizPanel.state.pluginId;
        next.pluginId = updates.vizConfig.group;
        vizStateUpdates.pluginId = updates.vizConfig.group;
      }
      if (updates.vizConfig.version !== undefined) {
        previous.pluginVersion = vizPanel.state.pluginVersion;
        next.pluginVersion = updates.vizConfig.version;
        vizStateUpdates.pluginVersion = updates.vizConfig.version;
      }
      if (updates.vizConfig.spec) {
        if (updates.vizConfig.spec.options !== undefined) {
          previous.options = vizPanel.state.options;
          const currentOptions = toRecord(vizPanel.state.options ?? {});
          const merged = deepMerge(currentOptions, toRecord(updates.vizConfig.spec.options));
          next.options = merged;
          vizStateUpdates.options = merged;
        }
        if (updates.vizConfig.spec.fieldConfig !== undefined) {
          previous.fieldConfig = vizPanel.state.fieldConfig;
          const currentFieldConfig = toRecord(vizPanel.state.fieldConfig ?? {});
          const currentDefaults = toRecord(currentFieldConfig.defaults ?? {});
          const newDefaults = updates.vizConfig.spec.fieldConfig.defaults
            ? deepMerge(currentDefaults, toRecord(updates.vizConfig.spec.fieldConfig.defaults))
            : currentDefaults;
          const currentOverrides = Array.isArray(currentFieldConfig.overrides) ? currentFieldConfig.overrides : [];
          const newOverrides = updates.vizConfig.spec.fieldConfig.overrides ?? currentOverrides;
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with FieldConfigSource
          const fieldConfig = {
            defaults: newDefaults,
            overrides: newOverrides,
          } as unknown as FieldConfigSource;
          next.fieldConfig = fieldConfig;
          vizStateUpdates.fieldConfig = transformMappingsToV1(fieldConfig);
        }
      }

      if (Object.keys(vizStateUpdates).length > 0) {
        vizPanel.setState(vizStateUpdates);
      }
    }
  }

  return { previousValue: previous, newValue: next };
}

/**
 * Apply data pipeline updates (queries, transformations, queryOptions).
 * Queries and transformations are replaced wholesale.
 */
function applyDataUpdates(
  vizPanel: VizPanel,
  dataUpdates: NonNullable<UpdatePanelPayload['panel']['data']>['spec'],
  changes: { previous: Record<string, unknown>; next: Record<string, unknown> }
): void {
  const dataPipeline = vizPanel.state.$data;

  // Resolve the query runner: it may be wrapped in a SceneDataTransformer
  let queryRunner: SceneQueryRunner | undefined;
  let dataTransformer: SceneDataTransformer | undefined;

  if (dataPipeline instanceof SceneDataTransformer) {
    dataTransformer = dataPipeline;
    if (dataPipeline.state.$data instanceof SceneQueryRunner) {
      queryRunner = dataPipeline.state.$data;
    }
  } else if (dataPipeline instanceof SceneQueryRunner) {
    queryRunner = dataPipeline;
  }

  // Update queries
  if (dataUpdates.queries !== undefined && queryRunner) {
    changes.previous.queries = queryRunner.state.queries;
    // Convert PanelQueryKind[] to SceneDataQuery[] using the canonical converter
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Zod output is structurally compatible with PanelQueryKind
    const sceneQueries = (dataUpdates.queries as unknown as PanelQueryKind[]).map(panelQueryKindToSceneQuery);
    changes.next.queries = sceneQueries;

    // Derive panel-level datasource from first query
    const firstQuery = dataUpdates.queries[0];
    const datasource = firstQuery?.spec?.query?.datasource?.name
      ? { uid: firstQuery.spec.query.datasource.name, type: firstQuery.spec.query.group }
      : firstQuery?.spec?.query?.group
        ? { type: firstQuery.spec.query.group }
        : undefined;

    queryRunner.setState({
      queries: sceneQueries,
      ...(datasource ? { datasource } : {}),
    });
  }

  // Update query options
  if (dataUpdates.queryOptions !== undefined && queryRunner) {
    const opts = dataUpdates.queryOptions;
    const runnerUpdates: Record<string, unknown> = {};
    if (opts.maxDataPoints !== undefined) {
      runnerUpdates.maxDataPoints = opts.maxDataPoints;
    }
    if (opts.interval !== undefined) {
      runnerUpdates.minInterval = opts.interval;
    }
    if (opts.cacheTimeout !== undefined) {
      runnerUpdates.cacheTimeout = opts.cacheTimeout;
    }
    if (opts.queryCachingTTL !== undefined) {
      runnerUpdates.queryCachingTTL = opts.queryCachingTTL;
    }
    if (Object.keys(runnerUpdates).length > 0) {
      changes.previous.queryOptions = {
        maxDataPoints: queryRunner.state.maxDataPoints,
        minInterval: queryRunner.state.minInterval,
        cacheTimeout: queryRunner.state.cacheTimeout,
        queryCachingTTL: queryRunner.state.queryCachingTTL,
      };
      changes.next.queryOptions = runnerUpdates;
      queryRunner.setState(runnerUpdates);
    }
  }

  // Update transformations
  if (dataUpdates.transformations !== undefined && dataTransformer) {
    changes.previous.transformations = dataTransformer.state.transformations;
    const transformations = dataUpdates.transformations.map((t) => ({
      id: t.spec.id,
      disabled: t.spec.disabled,
      options: t.spec.options ?? {},
    }));
    changes.next.transformations = transformations;
    dataTransformer.setState({ transformations });
    dataTransformer.reprocessTransformations();
  }
}

export const updatePanelCommand: MutationCommand<UpdatePanelPayload> = {
  name: 'UPDATE_PANEL',
  description: payloads.updatePanel.description ?? '',

  payloadSchema: payloads.updatePanel,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { element, panel: panelUpdates } = payload;
      const elementName = element.name;

      // Find the panel by element name
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: mutation system only runs inside DashboardScene
      const dashScene = scene as unknown as DashboardScene;
      const panelId = dashScene.serializer.getPanelIdForElement(elementName);
      if (panelId === undefined) {
        throw new Error(`Element "${elementName}" not found in the dashboard`);
      }

      const expectedKey = getVizPanelKeyForPanelId(panelId);
      const allPanels = scene.state.body.getVizPanels();
      const vizPanel = allPanels.find((p) => p.state.key === expectedKey);
      if (!vizPanel) {
        throw new Error(`Panel with ID ${panelId} (element "${elementName}") not found in the layout`);
      }

      // Apply metadata + vizConfig updates (with merge semantics)
      const { previousValue, newValue } = await applyPanelUpdates(vizPanel, panelUpdates);

      // Apply data pipeline updates (queries, transformations, queryOptions)
      if (panelUpdates.data?.spec) {
        applyDataUpdates(vizPanel, panelUpdates.data.spec, { previous: previousValue, next: newValue });
      }

      return {
        success: true,
        data: { element: elementName },
        changes: [
          {
            path: `/elements/${elementName}`,
            previousValue,
            newValue,
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
