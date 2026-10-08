import { waitFor } from '@testing-library/react';
import { of } from 'rxjs';

import {
  type DataQueryRequest,
  type DataSourceApi,
  type DataTransformerConfig,
  FieldType,
  LoadingState,
  type PanelData,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv, setRunRequest } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { ConstantVariable, SceneQueryRunner, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { TRANSFORM_SIDECAR_REF_ID, TransformSidecarDataTransformer } from './TransformSidecarDataTransformer';

const dsRef = { type: 'test-ds', uid: 'test-uid' };

function fakeDataSource(meta: { backend?: boolean; mixed?: boolean }): DataSourceApi {
  // Only the members SceneQueryRunner reads to build a request.
  return {
    uid: dsRef.uid,
    type: dsRef.type,
    name: 'Test',
    meta: { id: dsRef.type, ...meta },
    getRef: () => dsRef,
  } as unknown as DataSourceApi;
}

// Three rows, so a limit of 1 shows whether the browser applied the transformation.
const rawFrame = toDataFrame({
  refId: 'A',
  fields: [{ name: 'v', type: FieldType.number, values: [1, 2, 3] }],
});

let requests: DataQueryRequest[] = [];

function setUp({ backend = true, mixed = false }: { backend?: boolean; mixed?: boolean } = {}) {
  requests = [];
  const ds = fakeDataSource({ backend, mixed });
  setDataSourceSrv({
    get: () => Promise.resolve(ds),
    getInstanceSettings: () => undefined,
  } as unknown as DataSourceSrv);
  setRunRequest((_ds, request) => {
    requests.push(request);
    const data: PanelData = {
      state: LoadingState.Done,
      series: [rawFrame],
      timeRange: request.range,
      request,
    };
    return of(data);
  });
}

async function run(transformations: DataTransformerConfig[], queries: DataQuery[] = [{ refId: 'A' }]) {
  const runner = new SceneQueryRunner({ datasource: dsRef, queries });
  const transformer = new TransformSidecarDataTransformer({
    $timeRange: new SceneTimeRange({ timeZone: 'utc' }),
    $variables: new SceneVariableSet({ variables: [new ConstantVariable({ name: 'rows', value: '1' })] }),
    $data: runner,
    transformations,
  });
  transformer.activate();
  await waitFor(() => expect(transformer.state.data?.state).toBe(LoadingState.Done));
  return { runner, transformer, request: requests[requests.length - 1] };
}

const limitOne: DataTransformerConfig = { id: 'limit', options: { limitField: 1 } };

describe('TransformSidecarDataTransformer', () => {
  beforeAll(() => standardTransformersRegistry.setInit(getStandardTransformers));
  afterEach(() => setTestFlags({}));

  describe('with grafana.dashboardTransformationsSidecar on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardTransformationsSidecar]: true }));

    it('sends the transformations as a transform expression over the hidden visible queries', async () => {
      setUp();

      const { request } = await run([limitOne]);

      expect(request.targets).toEqual([
        { refId: 'A', datasource: dsRef, hide: true },
        {
          refId: TRANSFORM_SIDECAR_REF_ID,
          datasource: { type: '__expr__', uid: '__expr__', name: 'Expression' },
          type: 'transform',
          inputs: ['A'],
          transformations: [limitOne],
          timezone: 'utc',
        },
      ]);
    });

    it('does not apply the transformations again in the browser', async () => {
      setUp();

      const { transformer } = await run([limitOne]);

      // The fake server returns three rows; a limit of 1 applied in the browser would leave one.
      expect(transformer.state.data?.series[0].length).toBe(3);
    });

    it('interpolates dashboard variables in transformation options', async () => {
      setUp();

      const { request } = await run([{ id: 'limit', options: { limitField: '$rows' } }]);

      const transform = request.targets.find((t) => t.refId === TRANSFORM_SIDECAR_REF_ID);
      expect(transform).toMatchObject({ transformations: [{ id: 'limit', options: { limitField: '1' } }] });
    });

    it('leaves the saved queries and transformations unchanged', async () => {
      setUp();

      const { runner, transformer } = await run([limitOne]);

      expect(runner.state.queries).toEqual([{ refId: 'A' }]);
      expect(transformer.state.transformations).toEqual([limitOne]);
    });

    it.each([
      { name: 'a transformation the sidecar does not have', transformations: [{ id: 'rowsToFields', options: {} }] },
      { name: 'an annotations transformation', transformations: [{ ...limitOne, topic: 'annotations' }] },
      { name: 'only disabled transformations', transformations: [{ ...limitOne, disabled: true }] },
    ])('keeps browser transformations for $name', async ({ transformations }) => {
      setUp();

      const { request } = await run(transformations as DataTransformerConfig[]);

      expect(request.targets).toEqual([{ refId: 'A', datasource: dsRef }]);
    });

    it.each([
      { name: 'a frontend-only data source', options: { backend: false } },
      { name: 'a mixed data source', options: { backend: true, mixed: true } },
    ])('keeps browser transformations for $name', async ({ options }) => {
      setUp(options);

      const { request, transformer } = await run([limitOne]);

      expect(request.targets).toEqual([{ refId: 'A', datasource: dsRef }]);
      expect(transformer.state.data?.series[0].length).toBe(1);
    });

    it('keeps browser transformations when the panel already has an expression', async () => {
      setUp();
      const math = { refId: 'B', datasource: { type: '__expr__', uid: '__expr__' }, type: 'math', expression: '$A' };

      const { request } = await run([limitOne], [{ refId: 'A' }, math]);

      expect(request.targets.map((t) => t.refId)).toEqual(['A', 'B']);
    });
  });

  it('applies transformations in the browser when the flag is off', async () => {
    setUp();

    const { request, transformer } = await run([limitOne]);

    expect(request.targets).toEqual([{ refId: 'A', datasource: dsRef }]);
    expect(transformer.state.data?.series[0].length).toBe(1);
  });
});
