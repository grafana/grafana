import { __awaiter } from "tslib";
import { lastValueFrom } from 'rxjs';
import { DataLinkConfigOrigin } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { formatValueName } from '../explore/PrometheusListView/ItemLabels';
import { getData, toEnrichedCorrelationsData, } from './useCorrelations';
/**
 * Creates data links from provided CorrelationData object
 *
 * @param dataFrames list of data frames to be processed
 * @param correlations list of of possible correlations that can be applied
 * @param dataFrameRefIdToDataSourceUid a map that for provided refId references corresponding data source ui
 */
export const attachCorrelationsToDataFrames = (dataFrames, correlations, dataFrameRefIdToDataSourceUid) => {
    dataFrames.forEach((dataFrame) => {
        var _a;
        const frameRefId = dataFrame.refId;
        if (!frameRefId) {
            return;
        }
        let dataSourceUid = dataFrameRefIdToDataSourceUid[frameRefId];
        // rawPrometheus queries append a value to refId to a separate dataframe for the table view
        if (dataSourceUid === undefined && ((_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.preferredVisualisationType) === 'rawPrometheus') {
            const formattedRefID = formatValueName(frameRefId);
            dataSourceUid = dataFrameRefIdToDataSourceUid[formattedRefID];
        }
        const sourceCorrelations = correlations.filter((correlation) => correlation.source.uid === dataSourceUid);
        decorateDataFrameWithInternalDataLinks(dataFrame, sourceCorrelations);
    });
    return dataFrames;
};
const decorateDataFrameWithInternalDataLinks = (dataFrame, correlations) => {
    dataFrame.fields.forEach((field) => {
        var _a;
        field.config.links = ((_a = field.config.links) === null || _a === void 0 ? void 0 : _a.filter((link) => link.origin !== DataLinkConfigOrigin.Correlations)) || [];
        correlations.map((correlation) => {
            var _a, _b, _c;
            if (((_a = correlation.config) === null || _a === void 0 ? void 0 : _a.field) === field.name) {
                field.config.links.push({
                    internal: {
                        query: (_b = correlation.config) === null || _b === void 0 ? void 0 : _b.target,
                        datasourceUid: correlation.target.uid,
                        datasourceName: correlation.target.name,
                        transformations: (_c = correlation.config) === null || _c === void 0 ? void 0 : _c.transformations,
                    },
                    url: '',
                    title: correlation.label || correlation.target.name,
                    origin: DataLinkConfigOrigin.Correlations,
                });
            }
        });
    });
};
export const getCorrelationsBySourceUIDs = (sourceUIDs) => __awaiter(void 0, void 0, void 0, function* () {
    return lastValueFrom(getBackendSrv().fetch({
        url: `/api/datasources/correlations`,
        method: 'GET',
        showErrorAlert: false,
        params: {
            sourceUID: sourceUIDs,
        },
    }))
        .then(getData)
        .then(toEnrichedCorrelationsData);
});
export const createCorrelation = (sourceUID, correlation) => __awaiter(void 0, void 0, void 0, function* () {
    return getBackendSrv().post(`/api/datasources/uid/${sourceUID}/correlations`, correlation);
});
//# sourceMappingURL=utils.js.map