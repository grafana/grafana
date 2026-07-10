import { lokiEnricher } from './lokiEnricher';
import { promEnricher } from './promEnricher';
import { type QueryFlowEnricher } from './types';

/** Keyed by datasource `type`, mirroring `model/registry.ts` for mappers. */
const ENRICHERS_BY_DATASOURCE_TYPE: Record<string, QueryFlowEnricher> = {
  prometheus: promEnricher,
  loki: lokiEnricher,
};

export function getEnricherForDatasourceType(datasourceType: string | undefined): QueryFlowEnricher | undefined {
  return datasourceType ? ENRICHERS_BY_DATASOURCE_TYPE[datasourceType] : undefined;
}
