/**
 * UPDATE_PANEL command
 *
 * Partial update of an existing panel. All fields are optional;
 * only provided fields are applied. Options and fieldConfig are
 * deep-merged. Plugin type changes delegate to DashboardScene.changePanelPlugin()
 * which handles fieldConfig cleanup and $data pipeline management.
 */

import { mergeWith, cloneDeep, isArray } from 'lodash';
import { type z } from 'zod';

import { type FieldConfigSource } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { dashboardEditActions } from '../../edit-pane/shared';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { getUpdatedHoverHeader } from '../../scene/panel-timerange/utils';
import { getElements, panelQueryKindToSceneQuery } from '../../serialization/layoutSerializers/utils';
import { getQueryRunnerFor, getVizPanelKeyForPanelId } from '../../utils/utils';

import { serializeResultLayoutItem } from './panelSerialization';
import { payloads, type PanelQueryKind, type TransformationKind } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

const updatePanelPayloadSchema = payloads.updatePanel;

export type UpdatePanelPayload = z.infer<typeof updatePanelPayloadSchema>;

function mergeReplacingArrays(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  return mergeWith(cloneDeep(target), source, (_objValue: unknown, srcValue: unknown) => {
    if (isArray(srcValue)) {
      return srcValue;
    }
    return undefined;
  });
}

interface DataTransformerLike {
  state: { transformations?: unknown[]; $data?: unknown };
  setState: (state: { transformations?: unknown[] }) => void;
  reprocessTransformations: () => void;
}

interface RawLinksHolder {
  state: { rawLinks: unknown };
  setState: (state: Record<string, unknown>) => void;
}

function hasRawLinks(item: unknown): item is RawLinksHolder {
  if (!item || typeof item !== 'object' || !('state' in item) || !('setState' in item)) {
    return false;
  }
  const { state } = item;
  return typeof state === 'object' && state !== null && 'rawLinks' in state && typeof item.setState === 'function';
}

function isDataTransformer(data: unknown): data is DataTransformerLike {
  if (!data || typeof data !== 'object' || !('state' in data)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const state = (data as DataTransformerLike).state;
  return typeof state === 'object' && Array.isArray(state?.transformations);
}

interface PanelStateSnapshot {
  panel: Record<string, unknown>;
  rawLinks?: { holder: RawLinksHolder; value: unknown };
  queryRunner?: Record<string, unknown>;
  transformations?: unknown[];
  conditionalRendering?: unknown;
}

interface QueryRunnerLike {
  state: {
    queries?: unknown;
    maxDataPoints?: unknown;
    minInterval?: unknown;
    cacheTimeout?: unknown;
    queryCachingTTL?: unknown;
  };
  setState: (s: Record<string, unknown>) => void;
  runQueries: () => void;
}

function capturePanelState(
  vizPanel: VizPanel,
  queryRunner: QueryRunnerLike | undefined,
  dataPipeline: unknown,
  parent: unknown
): PanelStateSnapshot {
  const snapshot: PanelStateSnapshot = {
    panel: {
      title: vizPanel.state.title,
      hoverHeader: vizPanel.state.hoverHeader,
      description: vizPanel.state.description,
      displayMode: vizPanel.state.displayMode,
      options: vizPanel.state.options,
      fieldConfig: vizPanel.state.fieldConfig,
      $timeRange: vizPanel.state.$timeRange,
    },
  };

  const titleItems = vizPanel.state.titleItems;
  if (Array.isArray(titleItems)) {
    for (const item of titleItems) {
      if (hasRawLinks(item)) {
        snapshot.rawLinks = { holder: item, value: item.state.rawLinks };
        break;
      }
    }
  }

  if (queryRunner) {
    snapshot.queryRunner = {
      queries: queryRunner.state.queries,
      maxDataPoints: queryRunner.state.maxDataPoints,
      minInterval: queryRunner.state.minInterval,
      cacheTimeout: queryRunner.state.cacheTimeout,
      queryCachingTTL: queryRunner.state.queryCachingTTL,
    };
  }

  if (isDataTransformer(dataPipeline)) {
    snapshot.transformations = dataPipeline.state.transformations;
  }

  if (parent instanceof AutoGridItem) {
    snapshot.conditionalRendering = parent.state.conditionalRendering;
  }

  return snapshot;
}

function restorePanelState(
  vizPanel: VizPanel,
  queryRunner: QueryRunnerLike | undefined,
  dataPipeline: unknown,
  parent: unknown,
  snapshot: PanelStateSnapshot
): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  vizPanel.setState(snapshot.panel as Partial<VizPanel['state']>);

  if (snapshot.rawLinks) {
    snapshot.rawLinks.holder.setState({ rawLinks: snapshot.rawLinks.value });
  }

  if (queryRunner && snapshot.queryRunner) {
    queryRunner.setState(snapshot.queryRunner);
    queryRunner.runQueries();
  }

  if (isDataTransformer(dataPipeline) && snapshot.transformations !== undefined) {
    dataPipeline.setState({ transformations: snapshot.transformations });
    dataPipeline.reprocessTransformations();
  }

  if (parent instanceof AutoGridItem) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    parent.setState({ conditionalRendering: snapshot.conditionalRendering as never });
  }
}

export const updatePanelCommand: MutationCommand<UpdatePanelPayload> = {
  name: 'UPDATE_PANEL',
  description: payloads.updatePanel.description ?? '',

  payloadSchema: payloads.updatePanel,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { element, panel } = payload;
      const elementName = element.name;
      const spec = panel?.spec;

      const panelId = scene.serializer.getPanelIdForElement(elementName);
      if (panelId === undefined) {
        throw new Error(`Element "${elementName}" not found in the dashboard`);
      }

      const expectedKey = getVizPanelKeyForPanelId(panelId);
      const allPanels = scene.state.body.getVizPanels();
      const vizPanel = allPanels.find((p) => p.state.key === expectedKey);

      if (!vizPanel) {
        throw new Error(`Panel for element "${elementName}" not found in the layout`);
      }

      // Validate conditional rendering target before doing any mutations.
      if (payload.conditionalRendering !== undefined && !(vizPanel.parent instanceof AutoGridItem)) {
        throw new Error(
          'Show/hide rules are only supported with Auto grid layout. Switch the layout to Auto grid first.'
        );
      }

      const previousElement = getElements(scene.state.body, scene)[elementName];

      const isPluginChange = !!(spec?.vizConfig?.group && spec.vizConfig.group !== vizPanel.state.pluginId);

      // Plugin change is async and not undoable in this iteration. Apply eagerly.
      if (isPluginChange && spec?.vizConfig) {
        const vizConfig = spec.vizConfig;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newOptions = vizConfig.spec?.options as Record<string, unknown> | undefined;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newFieldConfig = vizConfig.spec?.fieldConfig as FieldConfigSource | undefined;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        await scene.changePanelPlugin(vizPanel, vizConfig.group!, newOptions, newFieldConfig);
      }

      // Capture state needed for undo, AFTER any plugin change (so refs are stable).
      const queryRunner = getQueryRunnerFor(vizPanel);
      const dataPipeline = vizPanel.state.$data;
      const parent = vizPanel.parent;
      const stateBefore = capturePanelState(vizPanel, queryRunner, dataPipeline, parent);

      const conditionalGroup =
        payload.conditionalRendering !== undefined
          ? ConditionalRenderingGroup.deserialize(payload.conditionalRendering)
          : undefined;

      const applyUpdates = () => {
        if (spec) {
          if (spec.title !== undefined) {
            scene.updatePanelTitle(vizPanel, spec.title);
          }

          if (spec.description !== undefined) {
            vizPanel.onDescriptionChange(spec.description);
          }

          if (spec.transparent !== undefined) {
            vizPanel.setState({ displayMode: spec.transparent ? 'transparent' : 'default' });
          }

          if (spec.links !== undefined) {
            const titleItems = vizPanel.state.titleItems;
            if (Array.isArray(titleItems)) {
              for (const item of titleItems) {
                if (hasRawLinks(item)) {
                  item.setState({ rawLinks: spec.links });
                  break;
                }
              }
            }
          }

          const vizConfig = spec.vizConfig;
          if (vizConfig && !isPluginChange) {
            // Zod parsed types and VizPanel state types don't overlap, so casts are needed.
            /* eslint-disable @typescript-eslint/consistent-type-assertions */
            if (vizConfig.spec?.options) {
              const merged = mergeReplacingArrays(
                (vizPanel.state.options ?? {}) as Record<string, unknown>,
                vizConfig.spec.options as Record<string, unknown>
              );
              vizPanel.onOptionsChange(merged, true);
            }

            if (vizConfig.spec?.fieldConfig) {
              const merged = mergeReplacingArrays(
                vizPanel.state.fieldConfig as unknown as Record<string, unknown>,
                vizConfig.spec.fieldConfig as unknown as Record<string, unknown>
              );
              vizPanel.onFieldConfigChange(merged as unknown as FieldConfigSource, true);
            }
            /* eslint-enable @typescript-eslint/consistent-type-assertions */
          }

          const dataSpec = spec.data?.spec;
          if (dataSpec) {
            if (dataSpec.queries && queryRunner) {
              const queries = dataSpec.queries.map((pq: PanelQueryKind) => panelQueryKindToSceneQuery(pq));
              queryRunner.setState({ queries });
              queryRunner.runQueries();
            }

            if (dataSpec.transformations !== undefined && isDataTransformer(dataPipeline)) {
              const transformations = dataSpec.transformations.map((t: TransformationKind) => ({
                id: t.group,
                disabled: t.spec.disabled,
                filter: t.spec.filter,
                topic: t.spec.topic,
                options: t.spec.options,
              }));
              dataPipeline.setState({ transformations });
              dataPipeline.reprocessTransformations();
            }

            if (dataSpec.queryOptions && queryRunner) {
              const qo = dataSpec.queryOptions;
              const runnerUpdate: Record<string, unknown> = {};

              if (qo.maxDataPoints !== undefined) {
                runnerUpdate.maxDataPoints = qo.maxDataPoints;
              }
              if (qo.interval !== undefined) {
                runnerUpdate.minInterval = qo.interval;
              }
              if (qo.cacheTimeout !== undefined) {
                runnerUpdate.cacheTimeout = qo.cacheTimeout;
              }
              if (qo.queryCachingTTL !== undefined) {
                runnerUpdate.queryCachingTTL = qo.queryCachingTTL;
              }

              if (Object.keys(runnerUpdate).length > 0) {
                queryRunner.setState(runnerUpdate);
              }

              if (qo.timeFrom !== undefined || qo.timeShift !== undefined) {
                const timeRange = new PanelTimeRange({
                  timeFrom: qo.timeFrom,
                  timeShift: qo.timeShift,
                  hideTimeOverride: qo.hideTimeOverride,
                });
                vizPanel.setState({
                  $timeRange: timeRange,
                  hoverHeader: getUpdatedHoverHeader(vizPanel.state.title, timeRange.state),
                });
              }
            }
          }
        }

        if (conditionalGroup !== undefined && parent instanceof AutoGridItem) {
          parent.setState({ conditionalRendering: conditionalGroup });
        }
      };

      dashboardEditActions.edit({
        description: t('dashboard.mutation-api.update-panel', 'Update panel'),
        source: vizPanel,
        perform: applyUpdates,
        undo: () => restorePanelState(vizPanel, queryRunner, dataPipeline, parent, stateBefore),
      });

      const fullElements = getElements(scene.state.body, scene);
      const updatedElement = fullElements[elementName];
      const resultLayoutItem = serializeResultLayoutItem(vizPanel);

      return {
        success: true,
        data: { element: updatedElement, layoutItem: resultLayoutItem },
        changes: [
          {
            path: `/elements/${elementName}`,
            previousValue: previousElement,
            newValue: updatedElement,
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
