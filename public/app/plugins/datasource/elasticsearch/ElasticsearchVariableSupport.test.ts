import { of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, FieldType } from '@grafana/data';

import { ElasticsearchVariableSupport } from './ElasticsearchVariableSupport';
import { ElasticsearchDataQuery } from './dataquery.gen';
import { ElasticDatasource } from './datasource';

jest.mock('./datasource');

describe('ElasticsearchVariableSupport', () => {
  let variableSupport: ElasticsearchVariableSupport<jest.Mocked<ElasticDatasource>>;
  let mockDatasource: jest.Mocked<ElasticDatasource>;

  beforeEach(() => {
    mockDatasource = {
      query: jest.fn(),
    } as unknown as jest.Mocked<ElasticDatasource>;

    variableSupport = new ElasticsearchVariableSupport(mockDatasource, jest.fn());
  });

  describe('getDefaultQuery', () => {
    it('should return default query with correct structure', () => {
      const defaultQuery = variableSupport.getDefaultQuery();

      expect(defaultQuery).toEqual({
        refId: 'ElasticsearchVariableQueryEditor-VariableQuery',
        query: '',
        metrics: [{ type: 'count', id: '1' }],
      });
    });
  });

  describe('query', () => {
    it('should throw error when no targets provided', async () => {
      const request: DataQueryRequest<ElasticsearchDataQuery> = {
        targets: [],
        requestId: 'test',
        interval: '1s',
        intervalMs: 1000,
        range: {
          from: dateTime(),
          to: dateTime(),
          raw: { from: 'now-1h', to: 'now' },
        },
        scopedVars: {},
        timezone: 'browser',
        app: 'dashboard',
        startTime: Date.now(),
      };

      await expect(
        new Promise((resolve, reject) => {
          variableSupport.query(request).subscribe({
            next: resolve,
            error: reject,
          });
        })
      ).rejects.toThrow('no variable query found');
    });

    it('should migrate query and return transformed data', (done) => {
      const mockResponse: DataQueryResponse = {
        data: [
          {
            name: 'test',
            refId: 'A',
            length: 2,
            fields: [
              { name: 'id', type: FieldType.number, config: {}, values: [1, 2] },
              { name: 'name', type: FieldType.string, config: {}, values: ['a', 'b'] },
            ],
          },
        ],
      };

      mockDatasource.query.mockReturnValue(of(mockResponse));

      const request: DataQueryRequest<ElasticsearchDataQuery> = {
        targets: [
          {
            refId: 'A',
            query: 'test',
            meta: {
              textField: 'name',
              valueField: 'id',
            },
          },
        ],
        requestId: 'test',
        interval: '1s',
        intervalMs: 1000,
        range: {
          from: dateTime(),
          to: dateTime(),
          raw: { from: 'now-1h', to: 'now' },
        },
        scopedVars: {},
        timezone: 'browser',
        app: 'dashboard',
        startTime: Date.now(),
      };

      variableSupport.query(request).subscribe({
        next: (response) => {
          expect(response.data).toHaveLength(1);
          expect(response.data[0].fields.length).toBeGreaterThanOrEqual(2);
          expect(response.data[0].fields[0].name).toBe('text');
          expect(response.data[0].fields[0].values).toEqual(['a', 'b']);
          expect(response.data[0].fields[1].name).toBe('value');
          expect(response.data[0].fields[1].values).toEqual([1, 2]);
          done();
        },
        error: done,
      });
    });

    it('should handle string query migration', (done) => {
      mockDatasource.metricFindQuery = jest.fn().mockResolvedValue([{ text: 'value1', value: 'value1' }]);

      const request: DataQueryRequest<ElasticsearchDataQuery> = {
        targets: ['test query' as unknown as ElasticsearchDataQuery],
        requestId: 'test',
        interval: '1s',
        intervalMs: 1000,
        range: {
          from: dateTime(),
          to: dateTime(),
          raw: { from: 'now-1h', to: 'now' },
        },
        scopedVars: {},
        timezone: 'browser',
        app: 'dashboard',
        startTime: Date.now(),
      };

      variableSupport.query(request).subscribe({
        next: (response) => {
          expect(mockDatasource.metricFindQuery).toHaveBeenCalledWith('test query', { range: request.range });
          expect(response.data).toHaveLength(1);
          expect(response.data[0].fields[0].name).toBe('text');
          expect(response.data[0].fields[0].values).toEqual(['value1']);
          expect(response.data[0].fields[1].name).toBe('value');
          expect(response.data[0].fields[1].values).toEqual(['value1']);
          done();
        },
        error: done,
      });
    });

    it('should handle meta field transformation', (done) => {
      const mockResponse: DataQueryResponse = {
        data: [
          {
            name: 'test',
            refId: 'A',
            length: 2,
            fields: [
              { name: '__text', type: FieldType.string, config: {}, values: ['text1', 'text2'] },
              { name: '__value', type: FieldType.string, config: {}, values: ['val1', 'val2'] },
            ],
          },
        ],
      };

      mockDatasource.query.mockReturnValue(of(mockResponse));

      const request: DataQueryRequest<ElasticsearchDataQuery> = {
        targets: [
          {
            refId: 'A',
            query: 'test',
          },
        ],
        requestId: 'test',
        interval: '1s',
        intervalMs: 1000,
        range: {
          from: dateTime(),
          to: dateTime(),
          raw: { from: 'now-1h', to: 'now' },
        },
        scopedVars: {},
        timezone: 'browser',
        app: 'dashboard',
        startTime: Date.now(),
      };

      variableSupport.query(request).subscribe({
        next: (response) => {
          expect(response.data[0].fields[0].name).toBe('text');
          expect(response.data[0].fields[1].name).toBe('value');
          done();
        },
        error: done,
      });
    });
  });
});
