import { __awaiter } from "tslib";
import { useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { getDataSourceSrv } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { InspectTab } from 'app/features/inspector/types';
import { supportsDataQuery } from '../PanelEditor/utils';
/**
 * Given PanelData return first data source supporting metadata inspector
 */
export const useDatasourceMetadata = (data) => {
    const state = useAsync(() => __awaiter(void 0, void 0, void 0, function* () { return getDataSourceWithInspector(data); }), [data]);
    return state.value;
};
export function getDataSourceWithInspector(data) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const targets = ((_a = data === null || data === void 0 ? void 0 : data.request) === null || _a === void 0 ? void 0 : _a.targets) || [];
        if (data && data.series && targets.length) {
            for (const frame of data.series) {
                if (frame.meta && frame.meta.custom) {
                    // get data source from first query
                    const dataSource = yield getDataSourceSrv().get(targets[0].datasource);
                    if (dataSource && ((_b = dataSource.components) === null || _b === void 0 ? void 0 : _b.MetadataInspector)) {
                        return dataSource;
                    }
                }
            }
        }
        return undefined;
    });
}
/**
 * Configures tabs for PanelInspector
 */
export const useInspectTabs = (panel, dashboard, plugin, hasError, metaDs) => {
    return useMemo(() => {
        const tabs = [];
        if (supportsDataQuery(plugin)) {
            tabs.push({ label: t('dashboard.inspect.data-tab', 'Data'), value: InspectTab.Data });
            tabs.push({ label: t('dashboard.inspect.stats-tab', 'Stats'), value: InspectTab.Stats });
        }
        if (metaDs) {
            tabs.push({ label: t('dashboard.inspect.meta-tab', 'Meta data'), value: InspectTab.Meta });
        }
        tabs.push({ label: t('dashboard.inspect.json-tab', 'JSON'), value: InspectTab.JSON });
        if (hasError) {
            tabs.push({ label: t('dashboard.inspect.error-tab', 'Error'), value: InspectTab.Error });
        }
        if (dashboard.meta.canEdit && supportsDataQuery(plugin)) {
            tabs.push({ label: t('dashboard.inspect.query-tab', 'Query'), value: InspectTab.Query });
        }
        return tabs;
    }, [plugin, metaDs, dashboard, hasError]);
};
//# sourceMappingURL=hooks.js.map