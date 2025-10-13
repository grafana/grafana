import { FieldType, toDataFrame } from '@grafana/data';
import { ActionResult } from 'app/percona/shared/services/actions/Actions.types';

import { PTSummaryService } from './PTSummary.service';
import { PTSummaryResponse, PTSummaryResult } from './PTSummary.types';
import { PTSummaryDataSource } from './PTSummaryDataSource';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({
    replace: () => 'node',
  }),
}));
jest.mock('app/percona/shared/services/actions/Actions.utils', () => ({
  getActionResult: async (actionId: string): Promise<ActionResult<string>> =>
    new Promise((resolve) => {
      resolve({
        loading: false,
        value: actionId,
        error: '',
      });
    }),
}));

describe('PTSummaryDatasource::', () => {
  it('Returns correct data for Node summary', async () => {
    const expected = {
      data: [
        toDataFrame({
          fields: [{ name: 'summary', values: ['node'], type: FieldType.string }],
        }),
      ],
    };
    const instance = new PTSummaryDataSource({});

    const response: PTSummaryResult = { action_id: 'node', pmm_agent_id: 'node' };
    PTSummaryService.getPTSummary = jest.fn().mockResolvedValueOnce(response);

    const result = await instance.query({
      targets: [{ refId: 'A', queryType: { type: 'node', variableName: undefined } }],
    } as any);

    expect(result).toEqual(expected);
  });

  it('Returns correct data for MySQL summary', async () => {
    const expected = {
      data: [
        toDataFrame({
          fields: [{ name: 'summary', values: ['mysql'], type: FieldType.string }],
        }),
      ],
    };
    const instance = new PTSummaryDataSource({});

    const response: PTSummaryResponse = { pt_mysql_summary: { action_id: 'mysql', pmm_agent_id: 'mysql' } };
    PTSummaryService.getMysqlPTSummary = jest.fn().mockResolvedValueOnce(response);

    const result = await instance.query({
      targets: [{ refId: 'A', queryType: { type: 'mysql', variableName: undefined } }],
    } as any);

    expect(result).toEqual(expected);
  });

  it('Returns correct data for MongoDB summary', async () => {
    const expected = {
      data: [
        toDataFrame({
          fields: [{ name: 'summary', values: ['mongo'], type: FieldType.string }],
        }),
      ],
    };
    const instance = new PTSummaryDataSource({});

    const response: PTSummaryResponse = { pt_mongodb_summary: { action_id: 'mongo', pmm_agent_id: 'mongo' } };
    PTSummaryService.getMongodbPTSummary = jest.fn().mockResolvedValueOnce(response);

    const result = await instance.query({
      targets: [{ refId: 'A', queryType: { type: 'mongodb', variableName: undefined } }],
    } as any);

    expect(result).toEqual(expected);
  });

  it('Returns correct data for PostgreSQL summary', async () => {
    const expected = {
      data: [
        toDataFrame({
          fields: [{ name: 'summary', values: ['postgresql'], type: FieldType.string }],
        }),
      ],
    };
    const instance = new PTSummaryDataSource({});

    const response: PTSummaryResponse = {
      pt_postgres_summary: { action_id: 'postgresql', pmm_agent_id: 'postgresql' },
    };
    PTSummaryService.getPostgresqlPTSummary = jest.fn().mockResolvedValueOnce(response);

    const result = await instance.query({
      targets: [{ refId: 'A', queryType: { type: 'postgresql', variableName: undefined } }],
    } as any);

    expect(result).toEqual(expected);
  });
});
