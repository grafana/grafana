import { __awaiter } from "tslib";
import { arrayToDataFrame, DataTopic, getDefaultTimeRange, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { dataLayers } from '@grafana/scenes';
import { PublicAnnotationsDataSource } from 'app/features/query/state/DashboardQueryRunner/PublicAnnotationsDataSource';
/**
 * This class is an extension to dataLayers.AnnotationsDataLayer to provide support for public dashboards.
 */
export class DashboardAnnotationsDataLayer extends dataLayers.AnnotationsDataLayer {
    resolveDataSource(query) {
        const _super = Object.create(null, {
            resolveDataSource: { get: () => super.resolveDataSource }
        });
        return __awaiter(this, void 0, void 0, function* () {
            if (config.publicDashboardAccessToken) {
                return new PublicAnnotationsDataSource();
            }
            return _super.resolveDataSource.call(this, query);
        });
    }
    processEvents(query, events) {
        if (config.publicDashboardAccessToken) {
            const stateUpdate = {
                series: [],
                timeRange: getDefaultTimeRange(),
                state: events.state,
            };
            const df = arrayToDataFrame(events.events);
            df.meta = Object.assign(Object.assign({}, df.meta), { dataTopic: DataTopic.Annotations });
            stateUpdate.annotations = [df];
            return stateUpdate;
        }
        else {
            return super.processEvents(query, events);
        }
    }
}
//# sourceMappingURL=DashboardAnnotationsDataLayer.js.map