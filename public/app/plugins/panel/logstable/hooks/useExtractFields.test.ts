import { renderHook, waitFor } from '@testing-library/react';

import {
  type DataLink,
  DataFrameType,
  FieldMatcherID,
  FieldType,
  type InterpolateFunction,
  LoadingState,
  standardEditorsRegistry,
  toDataFrame,
} from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';
import { type ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';
import { setLinkSrv } from 'app/features/panel/panellinks/link_srv';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

// Internal package imports, but not exposed to end users, how do we expect plugin developers to test anything that contains a transform?
import { mockTransformationsRegistry } from '../../../../../../packages/grafana-data/src/utils/tests/mockTransformationsRegistry';
import { initTemplateSrv } from '../../../../../test/helpers/initTemplateSrv';

import { useExtractFields } from './useExtractFields';

const testLogsDataFrame = [
  toDataFrame({
    meta: {
      type: DataFrameType.LogLines,
    },
    fields: [
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
      { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          { service: 'frontend', level: 'info' },
          { service: 'backend', level: 'error' },
        ],
      },
    ],
  }),
];

const traceLinkTestFrame = toDataFrame({
  meta: {
    type: DataFrameType.LogLines,
  },
  fields: [
    { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
    { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
    {
      name: 'labels',
      type: FieldType.other,
      values: [
        { service: 'frontend', level: 'info' },
        { service: 'backend', level: 'error' },
      ],
    },
    {
      name: 'traceID',
      type: FieldType.string,
      values: ['65e722de9921ef61e4cc0b26f1ba3fef', '65e722de9921ef61e4cc0b26f1ba3fef'],
      config: {
        links: [
          {
            title: 'Trace',
            url: '',
            internal: {
              datasourceUid: 'tempo-ds',
              datasourceName: 'Tempo',
              query: { query: '${__value.raw}', queryType: 'traceql' },
            },
          },
        ],
      },
    },
  ],
});

describe('useExtractFields', () => {
  beforeAll(() => {
    try {
      standardEditorsRegistry.setInit(getAllOptionEditors);
    } catch {
      // already initialized in this Jest worker
    }
    mockTransformationsRegistry([extractFieldsTransformer]);
  });

  test('returns extracted fields', async () => {
    const { result } = renderHook(() =>
      useExtractFields({
        rawTableFrame: testLogsDataFrame[0],
        timeZone: 'utc',
        loadingState: LoadingState.Done,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      })
    );

    await waitFor(() => {
      expect(result.current.extractedFrame?.fields[0].name).toBe(LOGS_DATAPLANE_TIMESTAMP_NAME);
      expect(result.current.extractedFrame?.fields[1].name).toBe(LOGS_DATAPLANE_BODY_NAME);
      expect(result.current.extractedFrame?.fields[2].name).toBe('labels');
      expect(result.current.extractedFrame?.fields[3].name).toBe('service');
      expect(result.current.extractedFrame?.fields[4].name).toBe('level');
    });
  });

  test('does not extract while the query is loading', async () => {
    const { result } = renderHook(() =>
      useExtractFields({
        rawTableFrame: testLogsDataFrame[0],
        timeZone: 'utc',
        loadingState: LoadingState.Loading,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      })
    );

    // Give any pending async extraction a chance to resolve before asserting nothing happened.
    await Promise.resolve();
    expect(result.current.extractedFrame).toBeNull();
  });

  test('re-extracts when a new frame arrives after loading completes', async () => {
    const props = {
      rawTableFrame: testLogsDataFrame[0],
      timeZone: 'utc',
      loadingState: LoadingState.Loading,
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    };
    const { result, rerender } = renderHook((p: typeof props) => useExtractFields(p), { initialProps: props });

    // While loading, nothing is extracted.
    await Promise.resolve();
    expect(result.current.extractedFrame).toBeNull();

    // Streaming/done emissions hand us a new frame reference with more rows; the hook must react to it.
    const streamedFrame = toDataFrame({
      meta: { type: DataFrameType.LogLines },
      fields: [
        { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2, 3] },
        { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2', 'log 3'] },
        {
          name: 'labels',
          type: FieldType.other,
          values: [
            { service: 'frontend', level: 'info' },
            { service: 'backend', level: 'info' },
            { service: 'frontend', level: 'error' },
          ],
        },
      ],
    });
    rerender({ ...props, rawTableFrame: streamedFrame, loadingState: LoadingState.Done });

    await waitFor(() => {
      expect(result.current.extractedFrame?.length).toBe(3);
    });
  });

  test('applies field override custom.width to extracted label columns', async () => {
    const { result } = renderHook(() =>
      useExtractFields({
        rawTableFrame: testLogsDataFrame[0],
        timeZone: 'utc',
        loadingState: LoadingState.Done,
        fieldConfig: {
          defaults: {},
          overrides: [
            {
              matcher: { id: FieldMatcherID.byName, options: 'service' },
              properties: [{ id: 'custom.width', value: 89 }],
            },
          ],
        },
      })
    );

    await waitFor(() => {
      const service = result.current.extractedFrame?.fields.find((f) => f.name === 'service');
      expect(service?.config.custom?.width).toBe(89);
    });
  });

  test('interpolates ${__value.raw} in internal trace links instead of LogQL variable escape', async () => {
    setTemplateSrv(initTemplateSrv('key', []));
    setContextSrv({
      hasAccessToExplore: () => true,
    } as ContextSrv);
    setLinkSrv({
      getDataLinkUIModel(link: DataLink, _replaceVariables: InterpolateFunction | undefined, origin) {
        return {
          href: link.url,
          title: link.title,
          target: '_blank',
          origin,
        };
      },
      getAnchorInfo(link) {
        return { ...link, href: link.url ?? '' };
      },
      getLinkUrl(link) {
        return link.url ?? '';
      },
    });

    const traceId = '65e722de9921ef61e4cc0b26f1ba3fef';
    const { result } = renderHook(() =>
      useExtractFields({
        rawTableFrame: traceLinkTestFrame,
        timeZone: 'utc',
        loadingState: LoadingState.Done,
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      })
    );

    await waitFor(() => {
      const traceField = result.current.extractedFrame?.fields.find((f) => f.name === 'traceID');
      expect(traceField?.getLinks).toBeDefined();
      const links = traceField?.getLinks!({ valueRowIndex: 0 });
      expect(links?.length).toBe(1);
      expect(links![0].href).toContain(traceId);
      expect(links![0].href).not.toContain('__V_');
    });
  });
});
