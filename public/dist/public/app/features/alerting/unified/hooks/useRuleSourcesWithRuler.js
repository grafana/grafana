import { getDataSourceByName } from '../utils/datasource';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';
export function useRulesSourcesWithRuler() {
    const dataSources = useUnifiedAlertingSelector((state) => state.dataSources);
    const dataSourcesWithRuler = Object.values(dataSources)
        .map((ds) => ds.result)
        .filter((ds) => Boolean(ds === null || ds === void 0 ? void 0 : ds.rulerConfig));
    // try fetching rules for each prometheus to see if it has ruler
    return dataSourcesWithRuler
        .map((ds) => getDataSourceByName(ds.name))
        .filter((dsConfig) => Boolean(dsConfig));
}
//# sourceMappingURL=useRuleSourcesWithRuler.js.map