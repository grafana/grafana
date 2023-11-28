import { groupBy } from 'lodash';
import { FieldType } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
export function getDerivedFields(dataFrame, derivedFieldConfigs) {
    if (!derivedFieldConfigs.length) {
        return [];
    }
    const derivedFieldsGrouped = groupBy(derivedFieldConfigs, 'name');
    const newFields = Object.values(derivedFieldsGrouped).map(fieldFromDerivedFieldConfig);
    // line-field is the first string-field
    // NOTE: we should create some common log-frame-extra-string-field code somewhere
    const lineField = dataFrame.fields.find((f) => f.type === FieldType.string);
    if (lineField === undefined) {
        // if this is happening, something went wrong, let's raise an error
        throw new Error('invalid logs-dataframe, string-field missing');
    }
    lineField.values.forEach((line) => {
        for (const field of newFields) {
            const logMatch = line.match(derivedFieldsGrouped[field.name][0].matcherRegex);
            field.values.push(logMatch && logMatch[1]);
        }
    });
    return newFields;
}
/**
 * Transform derivedField config into dataframe field with config that contains link.
 */
function fieldFromDerivedFieldConfig(derivedFieldConfigs) {
    const dataSourceSrv = getDataSourceSrv();
    const dataLinks = derivedFieldConfigs.reduce((acc, derivedFieldConfig) => {
        var _a;
        // Having field.datasourceUid means it is an internal link.
        if (derivedFieldConfig.datasourceUid) {
            const dsSettings = dataSourceSrv.getInstanceSettings(derivedFieldConfig.datasourceUid);
            const queryType = (type) => {
                switch (type) {
                    case 'tempo':
                        return 'traceql';
                    case 'grafana-x-ray-datasource':
                        return 'getTrace';
                    default:
                        return undefined;
                }
            };
            acc.push({
                // Will be filled out later
                title: derivedFieldConfig.urlDisplayLabel || '',
                url: '',
                // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
                internal: {
                    query: { query: derivedFieldConfig.url, queryType: queryType(dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.type) },
                    datasourceUid: derivedFieldConfig.datasourceUid,
                    datasourceName: (_a = dsSettings === null || dsSettings === void 0 ? void 0 : dsSettings.name) !== null && _a !== void 0 ? _a : 'Data source not found',
                },
            });
        }
        else if (derivedFieldConfig.url) {
            acc.push({
                // We do not know what title to give here so we count on presentation layer to create a title from metadata.
                title: derivedFieldConfig.urlDisplayLabel || '',
                // This is hardcoded for Jaeger or Zipkin not way right now to specify datasource specific query object
                url: derivedFieldConfig.url,
            });
        }
        return acc;
    }, []);
    return {
        name: derivedFieldConfigs[0].name,
        type: FieldType.string,
        config: {
            links: dataLinks,
        },
        // We are adding values later on
        values: [],
    };
}
//# sourceMappingURL=getDerivedFields.js.map