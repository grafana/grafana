import { FieldType, type DataFrameJSON } from '@grafana/data';
import { type BackendDataSourceResponse } from '@grafana/runtime';

import { redactQueryResponse } from './redactQueryResponse';

function stringFrame(refId: string, values: string[]): DataFrameJSON {
  return {
    schema: { refId, fields: [{ name: 'value', type: FieldType.string }] },
    data: { values: [values] },
  };
}

function requestBody(queries: Array<{ refId: string; type: string }>): string {
  return JSON.stringify({
    queries: queries.map(({ refId, type }) => ({ refId, datasource: { uid: `${type}-uid`, type } })),
    from: 'now-1h',
    to: 'now',
  });
}

function redact(response: BackendDataSourceResponse, body: string | undefined): BackendDataSourceResponse {
  return redactQueryResponse(response, body) as BackendDataSourceResponse;
}

describe('redactQueryResponse', () => {
  it('redacts real datasources and expressions but exempts testdata (including legacy alias)', () => {
    const response: BackendDataSourceResponse = {
      results: {
        A: { frames: [stringFrame('A', ['prom-secret'])] },
        B: { frames: [stringFrame('B', ['testdata-value'])] },
        C: { frames: [stringFrame('C', ['alias-value'])] },
        D: { frames: [stringFrame('D', ['expr-output'])] },
      },
    };
    const output = redact(
      response,
      requestBody([
        { refId: 'A', type: 'prometheus' },
        { refId: 'B', type: 'grafana-testdata-datasource' },
        { refId: 'C', type: 'testdata' },
        { refId: 'D', type: '__expr__' },
      ])
    );

    expect(output.results.A.frames![0].data!.values[0][0]).not.toBe('prom-secret');
    expect(output.results.D.frames![0].data!.values[0][0]).not.toBe('expr-output');
    // exempt responses pass through by reference
    expect(output.results.B).toBe(response.results.B);
    expect(output.results.C).toBe(response.results.C);
  });

  it('returns the same reference when every refId is exempt', () => {
    const response: BackendDataSourceResponse = {
      results: { A: { frames: [stringFrame('A', ['testdata-value'])] } },
    };
    const output = redact(response, requestBody([{ refId: 'A', type: 'grafana-testdata-datasource' }]));
    expect(output).toBe(response);
  });

  it('redacts everything when the request body is missing or unparseable', () => {
    const response: BackendDataSourceResponse = {
      results: { A: { frames: [stringFrame('A', ['testdata-value'])] } },
    };
    for (const body of [undefined, 'not-json{{{']) {
      const output = redact(response, body);
      expect(output).not.toBe(response);
      expect(output.results.A.frames![0].data!.values[0][0]).not.toBe('testdata-value');
    }
  });

  it('redacts error strings', () => {
    const response: BackendDataSourceResponse = {
      results: { A: { error: 'no rows for customer acme-corp', status: 500 } },
    };
    const output = redact(response, requestBody([{ refId: 'A', type: 'prometheus' }]));
    expect(output.results.A.error).toHaveLength('no rows for customer acme-corp'.length);
    expect(output.results.A.error).not.toBe('no rows for customer acme-corp');
    expect(output.results.A.status).toBe(500);
  });

  it('redacts legacy series keeping timestamps', () => {
    const response: BackendDataSourceResponse = {
      results: {
        A: {
          series: [
            {
              target: 'cpu{host=prod-1}',
              datapoints: [
                [42.5, 1700000000000],
                [null, 1700000060000],
              ],
            },
          ],
        },
      },
    };
    const output = redact(response, requestBody([{ refId: 'A', type: 'old-plugin' }]));
    const series = output.results.A.series![0];
    expect(series.target).not.toBe('cpu{host=prod-1}');
    expect(series.datapoints[0][0]).not.toBe(42.5);
    expect(series.datapoints[0][1]).toBe(1700000000000);
    expect(series.datapoints[1][0]).toBeNull();
    expect(series.datapoints[1][1]).toBe(1700000060000);
  });

  it('redacts every legacy table cell by runtime type', () => {
    const response: BackendDataSourceResponse = {
      results: {
        A: {
          tables: [
            {
              columns: [{ text: 'host' }, { text: 'count' }],
              rows: [
                ['prod-db-1', 12],
                ['prod-db-2', 7],
              ],
            },
          ],
        },
      },
    };
    const output = redact(response, requestBody([{ refId: 'A', type: 'old-plugin' }]));
    const table = output.results.A.tables![0];
    expect(table.rows[0][0]).not.toBe('prod-db-1');
    expect(table.rows[0][0]).toHaveLength('prod-db-1'.length);
    expect(table.rows[0][1]).not.toBe(12);
  });

  it('fails closed on an unrecognized envelope', () => {
    const bogus = { unexpected: 'customer-data' };
    const output = redactQueryResponse(bogus, undefined) as { unexpected: string };
    expect(output.unexpected).not.toBe('customer-data');
    expect(output.unexpected).toHaveLength('customer-data'.length);
  });

  it('does not mutate the input', () => {
    const response: BackendDataSourceResponse = {
      results: { A: { frames: [stringFrame('A', ['secret'])] } },
    };
    const before = JSON.parse(JSON.stringify(response));
    redactQueryResponse(response, undefined);
    expect(response).toEqual(before);
  });
});
