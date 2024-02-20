import { DataQueryResponse, DataSourceApi, toDataFrame, FieldType } from '@grafana/data';
import { getActionResult } from 'app/percona/shared/services/actions/Actions.utils';

import { PTSummaryService } from './PTSummary.service';
import { DatasourceType, PTSummaryResponse } from './PTSummary.types';

export class PTSummaryDataSource extends DataSourceApi {
  constructor(instanceSettings: any) {
    super(instanceSettings);
  }

  async query(options: any): Promise<DataQueryResponse> {
    const { variableName, type } = options.targets[0]?.queryType || {};

    const getRequest = (type: DatasourceType) => {
      switch (type) {
        case DatasourceType.node:
          return PTSummaryService.getPTSummary(variableName);
        case DatasourceType.mysql:
          return PTSummaryService.getMysqlPTSummary(variableName);
        case DatasourceType.mongodb:
          return PTSummaryService.getMongodbPTSummary(variableName);
        case DatasourceType.postgresql:
          return PTSummaryService.getPostgresqlPTSummary(variableName);
        default:
          return PTSummaryService.getPTSummary(variableName);
      }
    };

    return getRequest(type)
      .then(async (response) => {
        const result = await getActionResult<string>((response as PTSummaryResponse).action_id);

        return this.newDataFrame(result.value ? result.value : result.error);
      })
      .catch((error) => this.newDataFrame(error.response.data.message));
  }

  async testDatasource() {
    return {
      status: 'success',
      message: 'Success',
    };
  }

  newDataFrame(value: string) {
    return {
      data: [
        toDataFrame({
          fields: [
            {
              name: 'summary',
              values: [value],
              type: FieldType.string,
            },
          ],
        }),
      ],
    };
  }
}
