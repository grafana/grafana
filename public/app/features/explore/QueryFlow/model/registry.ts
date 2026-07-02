import { logqlMapper } from './languages/logql';
import { promqlMapper } from './languages/promql';
import { type QueryFlowMapper } from './mapper';

/** Keyed by datasource `type` (DataSourceApi.type / DataQuery.datasource.type). */
const MAPPERS_BY_DATASOURCE_TYPE: Record<string, QueryFlowMapper> = {
  prometheus: promqlMapper,
  loki: logqlMapper,
};

export function getMapperForDatasourceType(datasourceType: string | undefined): QueryFlowMapper | undefined {
  return datasourceType ? MAPPERS_BY_DATASOURCE_TYPE[datasourceType] : undefined;
}
