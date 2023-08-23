import { rest } from 'msw';
import { setupServer } from 'msw/node';

import {
  AlertState,
  DataFrameJSON,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
  toDataFrame,
} from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import 'whatwg-fetch';
import { StateHistoryImplementation } from '../../../hooks/useStateHistoryModal';

import * as common from './common';
import { extractCommonLabels, Label, omitLabels, updatePanelDataWithASHFromLoki } from './common';

test('extractCommonLabels', () => {
  const labels: Label[][] = [
    [
      ['foo', 'bar'],
      ['baz', 'qux'],
    ],
    [
      ['foo', 'bar'],
      ['baz', 'qux'],
      ['potato', 'tomato'],
    ],
  ];

  expect(extractCommonLabels(labels)).toStrictEqual([
    ['foo', 'bar'],
    ['baz', 'qux'],
  ]);
});

test('extractCommonLabels with no common labels', () => {
  const labels: Label[][] = [[['foo', 'bar']], [['potato', 'tomato']]];

  expect(extractCommonLabels(labels)).toStrictEqual([]);
});

test('omitLabels', () => {
  const labels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
    ['potato', 'tomato'],
  ];
  const commonLabels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
  ];

  expect(omitLabels(labels, commonLabels)).toStrictEqual([['potato', 'tomato']]);
});

test('omitLabels with no common labels', () => {
  const labels: Label[] = [['potato', 'tomato']];
  const commonLabels: Label[] = [
    ['foo', 'bar'],
    ['baz', 'qux'],
  ];

  expect(omitLabels(labels, commonLabels)).toStrictEqual(labels);
});

const server = setupServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });

  server.use(
    rest.get('/api/v1/rules/history', (req, res, ctx) =>
      res(
        ctx.json<DataFrameJSON>({
          data: {
            values: [
              [1681739580000, 1681739580000, 1681739580000],
              [
                {
                  previous: 'Normal',
                  current: 'Pending',
                  values: {
                    B: 0.010344684900897919,
                    C: 1,
                  },
                  labels: {
                    handler: '/api/prometheus/grafana/api/v1/rules',
                  },
                },
                {
                  previous: 'Normal',
                  current: 'Pending',
                  values: {
                    B: 0.010344684900897919,
                    C: 1,
                  },
                  dashboardUID: '',
                  panelID: 0,
                  labels: {
                    handler: '/api/live/ws',
                  },
                },
                {
                  previous: 'Normal',
                  current: 'Pending',
                  values: {
                    B: 0.010344684900897919,
                    C: 1,
                  },
                  labels: {
                    handler: '/api/folders/:uid/',
                  },
                },
              ],
            ],
          },
        })
      )
    )
  );
});

afterAll(() => {
  server.close();
});

jest.spyOn(common, 'getHistoryImplementation').mockImplementation(() => StateHistoryImplementation.Loki);
const getHistoryImplementationMock = common.getHistoryImplementation as jest.MockedFunction<
  typeof common.getHistoryImplementation
>;
const timeRange = getDefaultTimeRange();
const panelDataProcessed: PanelData = {
  alertState: {
    id: 1,
    dashboardId: 1,
    panelId: 1,
    state: AlertState.Alerting,
  },
  series: [
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time },
        { name: 'score', type: FieldType.number },
      ],
    }),
  ],
  annotations: [toDataFrame([{ id: 'panelData' }]), toDataFrame([{ id: 'dashData' }])],
  state: LoadingState.Done,
  timeRange,
};

describe('updatePanelDataWithASHFromLoki', () => {
  it('should return the same panelData if not using Loki as implementation', async () => {
    getHistoryImplementationMock.mockImplementation(() => StateHistoryImplementation.Annotations);

    const panelData = await updatePanelDataWithASHFromLoki(panelDataProcessed);

    expect(panelData).toStrictEqual(panelDataProcessed);
    expect(panelData.annotations).toHaveLength(2);
  });

  it('should return the correct panelData if using Loki as implementation', async () => {
    getHistoryImplementationMock.mockImplementation(() => StateHistoryImplementation.Loki);

    const panelData = await updatePanelDataWithASHFromLoki(panelDataProcessed);

    expect(panelData.annotations).toHaveLength(5);
  });

  it('should return the same panelData if Loki call throws an error', async () => {
    getHistoryImplementationMock.mockImplementation(() => StateHistoryImplementation.Loki);

    server.use(rest.get('/api/v1/rules/history', (req, res, ctx) => res(ctx.status(500))));

    const panelData = await updatePanelDataWithASHFromLoki(panelDataProcessed);

    expect(panelData).toStrictEqual(panelDataProcessed);
    expect(panelData.annotations).toHaveLength(2);
  });
});
