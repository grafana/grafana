import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import { AlignmentTypes, QueryType } from './types/query';
// The legacy query format sets the title and text values to empty strings by default.
// If the title or text is not undefined at the top-level of the annotation target,
// then it is a legacy query.
const isLegacyCloudMonitoringAnnotation = (query) => {
    var _a, _b;
    return ((_a = query.target) === null || _a === void 0 ? void 0 : _a.title) !== undefined ||
        ((_b = query.target) === null || _b === void 0 ? void 0 : _b.text) !== undefined;
};
export const CloudMonitoringAnnotationSupport = (ds) => {
    return {
        prepareAnnotation: (query) => {
            if (!isLegacyCloudMonitoringAnnotation(query)) {
                return query;
            }
            const { enable, name, iconColor } = query;
            const { target } = query;
            const result = {
                datasource: query.datasource,
                enable,
                name,
                iconColor,
                target: {
                    intervalMs: ds.intervalMs,
                    refId: (target === null || target === void 0 ? void 0 : target.refId) || 'annotationQuery',
                    queryType: QueryType.ANNOTATION,
                    timeSeriesList: {
                        projectName: (target === null || target === void 0 ? void 0 : target.projectName) || ds.getDefaultProject(),
                        filters: (target === null || target === void 0 ? void 0 : target.filters) || [],
                        crossSeriesReducer: 'REDUCE_NONE',
                        perSeriesAligner: AlignmentTypes.ALIGN_NONE,
                        title: (target === null || target === void 0 ? void 0 : target.title) || '',
                        text: (target === null || target === void 0 ? void 0 : target.text) || '',
                    },
                },
            };
            return result;
        },
        prepareQuery: (anno) => {
            if (!anno.target) {
                return undefined;
            }
            return Object.assign(Object.assign({}, anno.target), { queryType: QueryType.ANNOTATION, type: 'annotationQuery' });
        },
        QueryEditor: AnnotationQueryEditor,
    };
};
//# sourceMappingURL=annotationSupport.js.map