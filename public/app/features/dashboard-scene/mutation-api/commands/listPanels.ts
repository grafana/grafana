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

import { type DataFrame, type DataQueryError, LoadingState } from '@grafana/data';
import { sceneGraph, SceneDataTransformer, type SceneObject, type VizPanel } from '@grafana/scenes';

import { getElements } from '../../serialization/layoutSerializers/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils';
import type {
  FrameSchema,
  FieldSchema,
  PanelElementEntry,
  PanelRuntimeError,
  PanelRuntimeNotice,
  PanelRuntimeStatus,
} from '../types';

import { serializeResultLayoutItem } from './panelSerialization';
import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

const listPanelsPayloadSchema = payloads.listPanels;

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

function getPanelRuntimeStatus(vizPanel: VizPanel): PanelRuntimeStatus | undefined {
  // A missing/unknown plugin throws on import and sets `_pluginLoadError`; a module
  // that fails to compile resolves to an error plugin (`loadError`) without throwing.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- loadError is set ad-hoc by getPanelPluginError, not on the PanelPlugin type
  const pluginCompileFailed = (vizPanel.getPlugin() as { loadError?: boolean } | undefined)?.loadError;
  const pluginError =
    vizPanel.state._pluginLoadError ??
    (pluginCompileFailed ? `Panel plugin failed to load: ${vizPanel.state.pluginId}` : undefined);
  if (pluginError) {
    return {
      loadingState: LoadingState.Error,
      hasError: true,
      hasNoData: false,
      errors: [{ source: 'plugin', message: pluginError }],
    };
  }

  const dataProvider = vizPanel.state.$data;
  if (!dataProvider) {
    return undefined;
  }

  const innerProvider = dataProvider instanceof SceneDataTransformer ? dataProvider.state.$data : dataProvider;
  const panelData = (innerProvider ?? dataProvider)?.state?.data;

  if (!panelData) {
    return { loadingState: LoadingState.Loading, hasError: false, hasNoData: false };
  }

  const { state, errors, error, series } = panelData;

  const isLoading =
    state === LoadingState.Loading || state === LoadingState.Streaming || state === LoadingState.NotStarted;
  if (isLoading) {
    return { loadingState: state, hasError: false, hasNoData: false };
  }

  // `data.message` holds the text for HTTP/backend errors; entries with no usable
  // field are dropped so hasError never flips true on an empty `{}`.
  const sourceErrors: DataQueryError[] = errors?.length ? errors : error ? [error] : [];
  const errorList: PanelRuntimeError[] = sourceErrors
    .map((e): PanelRuntimeError => {
      const message = e.message ?? e.data?.message;
      return {
        source: 'query',
        ...(message !== undefined && { message }),
        ...(e.refId !== undefined && { refId: e.refId }),
        ...(e.type !== undefined && { type: e.type }),
      };
    })
    .filter((d) => d.message !== undefined || d.refId !== undefined || d.type !== undefined);

  // Error-severity notices are a real error channel, so fold them into `errors`.
  const notices: PanelRuntimeNotice[] = [];
  const seen = new Set<string>();
  if (Array.isArray(series)) {
    for (const frame of series) {
      for (const notice of frame.meta?.notices ?? []) {
        const key = `${notice.severity}:${notice.text}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        if (notice.severity === 'error') {
          errorList.push({ source: 'notice', message: notice.text });
        } else {
          notices.push({ severity: notice.severity, text: notice.text });
        }
      }
    }
  }

  const hasData = Array.isArray(series) && series.some((s: DataFrame) => s.fields.length > 0);

  return {
    loadingState: state,
    hasError: errorList.length > 0 || state === LoadingState.Error,
    hasNoData: !hasData,
    ...(errorList.length > 0 && { errors: errorList }),
    ...(notices.length > 0 && { notices }),
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

      const elements: PanelElementEntry[] = [];

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

        const entry: PanelElementEntry = { element, layoutItem };

        if (vizPanel) {
          if (payload.includeStatus) {
            const status = getPanelRuntimeStatus(vizPanel);
            if (status) {
              entry.status = status;
            }
          }
          if (payload.includeSchema) {
            const dataSchema = getDataFrameSchema(vizPanel);
            if (dataSchema) {
              entry.dataSchema = dataSchema;
            }
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
