import { MockObservableDataSourceApi } from '../../../../../test/mocks/datasource_srv';
import { createLokiLogsVolumeProvider } from './logsVolumeProvider';
import LokiDatasource from '../datasource';
import { DataQueryRequest, DataQueryResponse, FieldType, LoadingState, toDataFrame } from '@grafana/data';
import { LokiQuery } from '../types';
import { Observable } from 'rxjs';

function createFrame(labels: object, timestamps: number[], values: number[]) {
  return toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: timestamps },
      {
        name: 'Number',
        type: FieldType.number,
        values,
        labels,
      },
    ],
  });
}

function createExpectedFields(levelName: string, timestamps: number[], values: number[]) {
  return [
    { name: 'Time', values: { buffer: timestamps } },
    {
      name: 'Value',
      config: { displayNameFromDS: levelName },
      values: { buffer: values },
    },
  ];
}

describe('LokiLogsVolumeProvider', () => {
  let volumeProvider: Observable<DataQueryResponse>,
    datasource: MockObservableDataSourceApi,
    request: DataQueryRequest<LokiQuery>;

  function setup(datasourceSetup: () => void) {
    datasourceSetup();
    request = ({
      targets: [{ expr: '{app="app01"}' }, { expr: '{app="app02"}' }],
      range: { from: 0, to: 1 },
      scopedVars: {
        __interval_ms: {
          value: 1000,
        },
      },
    } as unknown) as DataQueryRequest<LokiQuery>;
    volumeProvider = createLokiLogsVolumeProvider((datasource as unknown) as LokiDatasource, request);
  }

  function setupMultipleResults() {
    // level=unknown
    const resultAFrame1 = createFrame({ app: 'app01' }, [100, 200, 300], [5, 5, 5]);
    // level=error
    const resultAFrame2 = createFrame({ app: 'app01', level: 'error' }, [100, 200, 300], [0, 1, 0]);
    // level=unknown
    const resultBFrame1 = createFrame({ app: 'app02' }, [100, 200, 300], [1, 2, 3]);
    // level=error
    const resultBFrame2 = createFrame({ app: 'app02', level: 'error' }, [100, 200, 300], [1, 1, 1]);

    datasource = new MockObservableDataSourceApi('loki', [
      {
        data: [resultAFrame1, resultAFrame2],
      },
      {
        data: [resultBFrame1, resultBFrame2],
      },
    ]);
  }

  function setupErrorResponse() {
    datasource = new MockObservableDataSourceApi('loki', [], undefined, 'Error message');
  }

  it('aggregates data frames by level', async () => {
    setup(setupMultipleResults);

    await expect(volumeProvider).toEmitValuesWith((received) => {
      expect(received).toMatchObject([
        { state: LoadingState.Loading, error: undefined, data: [] },
        {
          state: LoadingState.Done,
          error: undefined,
          data: [
            {
              fields: createExpectedFields('unknown', [100, 200, 300], [6, 7, 8]),
            },
            {
              fields: createExpectedFields('error', [100, 200, 300], [1, 2, 1]),
            },
          ],
        },
      ]);
    });
  });

  it('returns error', async () => {
    setup(setupErrorResponse);

    await expect(volumeProvider).toEmitValuesWith((received) => {
      expect(received).toMatchObject([
        { state: LoadingState.Loading, error: undefined, data: [] },
        {
          state: LoadingState.Error,
          error: 'Error message',
          data: [],
        },
        'Error message',
      ]);
    });
  });
});
