/**
 * LIST_PANELS command
 *
 * Returns elements on the dashboard (panels, library panels, etc.)
 * as an array of { element, layoutItem } entries. The element name is
 * embedded in layoutItem.spec.element.name (v2beta1 ElementReference).
 *
 * Optional filters:
 *  - elements: return only named elements
 *  - evaluateVariables: include evaluatedQueries with resolved template vars
 *  - includeStatus: include runtime status and data frame schema per panel
 */

import { type z } from 'zod';

import { LoadingState } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { sceneGraph, SceneDataTransformer, type SceneObject, type VizPanel } from '@grafana/scenes';

import { getElements } from '../../serialization/layoutSerializers/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils';

import { serializeResultLayoutItem } from './panelSerialization';
import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const listPanelsPayloadSchema = payloads.listPanels;

export type ListPanelsPayload = z.infer<typeof listPanelsPayloadSchema>;

function deepInterpolate(sceneObj: SceneObject, value: unknown): unknown {
  if (typeof value === 'string') {
    return sceneGraph.interpolate(sceneObj, value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepInterpolate(sceneObj, item));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deepInterpolate(sceneObj, v);
    }
    return result;
  }
  return value;
}

interface PanelRuntimeStatus {
  isLoading: boolean;
  hasError: boolean;
  hasNoData: boolean;
  errors?: string[];
}

interface FieldSchema {
  name: string;
  type: string;
  labels?: Record<string, string>;
}

interface FrameSchema {
  name?: string;
  fields: FieldSchema[];
}

function getPanelRuntimeStatus(vizPanel: VizPanel): PanelRuntimeStatus | undefined {
  const dataProvider = vizPanel.state.$data;
  if (!dataProvider) {
    return undefined;
  }

  const innerProvider = dataProvider instanceof SceneDataTransformer ? dataProvider.state.$data : dataProvider;
  const panelData = (innerProvider ?? dataProvider)?.state?.data;

  if (!panelData) {
    return { isLoading: true, hasError: false, hasNoData: false };
  }

  const { state, errors, error, series } = panelData;

  const isLoading =
    state === LoadingState.Loading || state === LoadingState.Streaming || state === LoadingState.NotStarted;
  if (isLoading) {
    return { isLoading: true, hasError: false, hasNoData: false };
  }

  const allErrors: string[] = [];
  if (errors?.length) {
    for (const e of errors) {
      if (e.message) {
        allErrors.push(e.message);
      }
    }
  } else if (error?.message) {
    allErrors.push(error.message);
  }

  const hasData = Array.isArray(series) && series.some((s: DataFrame) => s.fields.length > 0);

  return {
    isLoading: false,
    hasError: allErrors.length > 0,
    hasNoData: !hasData,
    ...(allErrors.length > 0 && { errors: allErrors }),
  };
}

function getDataFrameSchema(vizPanel: VizPanel): FrameSchema[] | undefined {
  const dataProvider = vizPanel.state.$data;
  if (!dataProvider) {
    return undefined;
  }

  const innerProvider = dataProvider instanceof SceneDataTransformer ? dataProvider.state.$data : dataProvider;
  const panelData = (innerProvider ?? dataProvider)?.state?.data;

  if (!panelData?.series || !Array.isArray(panelData.series)) {
    return undefined;
  }

  const schemas: FrameSchema[] = [];
  for (const frame of panelData.series) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- series comes from untyped SceneDataProvider state
    const df = frame as DataFrame;
    const fields: FieldSchema[] = df.fields.map((field) => ({
      name: field.name ?? '',
      type: field.type ?? 'unknown',
      ...(field.labels && Object.keys(field.labels).length > 0 && { labels: field.labels }),
    }));
    schemas.push({
      ...(df.name ? { name: df.name } : {}),
      fields,
    });
  }

  return schemas.length > 0 ? schemas : undefined;
}

export const listPanelsCommand: MutationCommand<ListPanelsPayload> = {
  name: 'LIST_PANELS',
  description: payloads.listPanels.description ?? '',

  payloadSchema: payloads.listPanels,
  permission: readOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;

    try {
      const body = scene.state.body;
      const fullElements = getElements(body, scene);
      const allPanels = body.getVizPanels();

      const filterSet = payload.elements ? new Set(payload.elements) : undefined;

      const elementEntries = Object.entries(fullElements).filter(([name]) => !filterSet || filterSet.has(name));

      const elements: Array<Record<string, unknown>> = [];

      for (const [elementName, element] of elementEntries) {
        const panelId = scene.serializer.getPanelIdForElement(elementName);
        const expectedKey = panelId !== undefined ? getVizPanelKeyForPanelId(panelId) : undefined;
        const vizPanel = expectedKey ? allPanels.find((p) => p.state.key === expectedKey) : undefined;

        const layoutItem = vizPanel
          ? serializeResultLayoutItem(vizPanel)
          : {
              kind: 'AutoGridLayoutItem' as const,
              spec: { element: { kind: 'ElementReference' as const, name: elementName } },
            };

        const entry: Record<string, unknown> = { element, layoutItem };

        if (payload.includeStatus && vizPanel) {
          const status = getPanelRuntimeStatus(vizPanel);
          if (status) {
            entry.status = status;
          }

          const dataSchema = getDataFrameSchema(vizPanel);
          if (dataSchema) {
            entry.dataSchema = dataSchema;
          }
        }

        elements.push(entry);
      }

      const data: Record<string, unknown> = { elements };

      if (payload.evaluateVariables) {
        const evaluated: unknown[] = [];
        for (const [elementName, element] of elementEntries) {
          const spec = element?.spec;
          if (!spec || !('data' in spec)) {
            continue;
          }
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- PanelSpec.data is typed; LibraryPanelKindSpec is excluded above
          const dataSpec = (spec.data as { spec?: { queries?: unknown[] } })?.spec;
          const queries = dataSpec?.queries;
          if (!Array.isArray(queries) || queries.length === 0) {
            continue;
          }
          for (const query of queries) {
            const resolved = deepInterpolate(scene, query);
            if (JSON.stringify(resolved) !== JSON.stringify(query)) {
              evaluated.push({ element: elementName, original: query, evaluated: resolved });
            }
          }
        }
        if (evaluated.length > 0) {
          data.evaluatedQueries = evaluated;
        }
      }

      return {
        success: true,
        data,
        changes: [],
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
