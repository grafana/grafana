import { of } from 'rxjs';

import { FieldType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { readScalar, runInstantQueries } from './overviewShared';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

const mockGetDataSourceSrv = jest.mocked(getDataSourceSrv);
const query = jest.fn();

function setDataSources() {
  mockGetDataSourceSrv.mockReturnValue({
    getList: () => [{ uid: 'prom', isDefault: true, type: 'prometheus' }],
    get: async () => ({ query }),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

beforeEach(() => {
  query.mockReset();
  setDataSources();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('overviewShared', () => {
  it('normalizes native Prometheus instant responses to frames', async () => {
    query.mockImplementation((request) => {
      const refId = request.targets[0].refId;

      switch (refId) {
        case 'scalar':
          return of({ status: 'success', data: { resultType: 'scalar', result: [1782476666, '7'] } });
        case 'vector':
          return of({
            data: {
              status: 'success',
              data: {
                resultType: 'vector',
                result: [{ metric: { job: 'api' }, value: [1782476667, '3'] }],
              },
            },
          });
        case 'matrix':
          return of({
            status: 'success',
            data: {
              resultType: 'matrix',
              result: [
                {
                  metric: { pod: 'api-1' },
                  values: [
                    [1782476668, '1'],
                    [1782476669, '2'],
                  ],
                },
              ],
            },
          });
        default:
          return of({ data: [] });
      }
    });

    const frames = await runInstantQueries('prometheus', {
      scalar: 'scalar_query',
      vector: 'vector_query',
      matrix: 'matrix_query',
    });

    expect(query).toHaveBeenCalledTimes(4);
    expect(readScalar(frames, 'scalar')).toBe(7);
    expect(readScalar(frames, 'vector')).toBe(3);
    expect(readScalar(frames, 'matrix')).toBe(2);
    expect(
      frames.find((frame) => frame.refId === 'scalar')?.fields.find((field) => field.type === FieldType.time)?.values[0]
    ).toBe(1782476666000);
  });
});
