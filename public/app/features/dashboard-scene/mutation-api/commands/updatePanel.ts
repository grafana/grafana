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

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { getUpdatedHoverHeader } from '../../panel-edit/getPanelFrameOptions';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { PanelTimeRange } from '../../scene/panel-timerange/PanelTimeRange';
import { getElements, panelQueryKindToSceneQuery } from '../../serialization/layoutSerializers/utils';
import { getQueryRunnerFor, getVizPanelKeyForPanelId } from '../../utils/utils';

import { serializeResultLayoutItem } from './panelSerialization';
import { payloads, type PanelQueryKind, type TransformationKind } from './schemas';
import { enterEditModeIfNeeded, requiresEdit, type MutationCommand } from './types';

export const updatePanelPayloadSchema = payloads.updatePanel;

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

      const previousElement = getElements(scene.state.body, scene)[elementName];

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
        if (vizConfig) {
          const isPluginChange = vizConfig.group && vizConfig.group !== vizPanel.state.pluginId;

          // Zod parsed types and VizPanel state types don't overlap, so casts are needed.
          /* eslint-disable @typescript-eslint/consistent-type-assertions */
          if (isPluginChange) {
            const newOptions = vizConfig.spec?.options as Record<string, unknown> | undefined;
            const newFieldConfig = vizConfig.spec?.fieldConfig as FieldConfigSource | undefined;
            await scene.changePanelPlugin(vizPanel, vizConfig.group!, newOptions, newFieldConfig);
          } else {
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
          }
          /* eslint-enable @typescript-eslint/consistent-type-assertions */
        }

        const dataSpec = spec.data?.spec;
        if (dataSpec) {
          const dataPipeline = vizPanel.state.$data;
          const queryRunner = getQueryRunnerFor(vizPanel);
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
                hoverHeader: getUpdatedHoverHeader(vizPanel.state.title, timeRange),
              });
            }
          }
        }
      }

      if (payload.conditionalRendering !== undefined) {
        const parent = vizPanel.parent;
        if (parent instanceof AutoGridItem) {
          const group = ConditionalRenderingGroup.deserialize(payload.conditionalRendering);
          parent.setState({ conditionalRendering: group });
        } else {
          throw new Error(
            'Show/hide rules are only supported with Auto grid layout. Switch the layout to Auto grid first.'
          );
        }
      }

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
