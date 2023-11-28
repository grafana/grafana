import { first, uniqBy } from 'lodash';
import { useCallback } from 'react';
import { mapInternalLinkToExplore, getFieldDisplayValuesProxy, DataLinkConfigOrigin, CoreApp, } from '@grafana/data';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getTransformationVars } from 'app/features/correlations/transformations';
import { getLinkSrv } from '../../panel/panellinks/link_srv';
const dataLinkHasRequiredPermissionsFilter = (link) => {
    return !link.internal || contextSrv.hasAccessToExplore();
};
/**
 * Fixed list of filters used in Explore. DataLinks that do not pass all the filters will not
 * be passed back to the visualization.
 */
const DATA_LINK_FILTERS = [dataLinkHasRequiredPermissionsFilter];
const DATA_LINK_USAGE_KEY = 'grafana_data_link_clicked';
/**
 * Creates an internal link supplier specific to Explore
 */
export const exploreDataLinkPostProcessorFactory = (splitOpenFn, range) => {
    const exploreDataLinkPostProcessor = (options) => {
        const { field, dataLinkScopedVars: vars, frame: dataFrame, link, linkModel } = options;
        const { valueRowIndex: rowIndex } = options.config;
        if (!link.internal || rowIndex === undefined) {
            return linkModel;
        }
        /**
         * Even though getFieldLinksForExplore can produce internal and external links we re-use the logic for creating
         * internal links only. Eventually code from getFieldLinksForExplore can be moved here and getFieldLinksForExplore
         * can be removed (once all Explore panels start using field.getLinks).
         */
        const links = getFieldLinksForExplore({
            field,
            rowIndex,
            splitOpenFn,
            range,
            vars,
            dataFrame,
            linksToProcess: [link],
        });
        return links.length ? first(links) : undefined;
    };
    return exploreDataLinkPostProcessor;
};
/**
 * Get links from the field of a dataframe and in addition check if there is associated
 * metadata with datasource in which case we will add onClick to open the link in new split window. This assumes
 * that we just supply datasource name and field value and Explore split window will know how to render that
 * appropriately. This is for example used for transition from log with traceId to trace datasource to show that
 * trace.
 *
 * Note: accessing a field via ${__data.fields.variable} will stay consistent with dashboards and return as existing but with an empty string
 * Accessing a field with ${variable} will return undefined as this is unique to explore.
 * @deprecated Use field.getLinks directly
 */
export const getFieldLinksForExplore = (options) => {
    const { field, vars, splitOpenFn, range, rowIndex, dataFrame } = options;
    const scopedVars = Object.assign({}, (vars || {}));
    scopedVars['__value'] = {
        value: {
            raw: field.values[rowIndex],
        },
        text: 'Raw value',
    };
    let fieldDisplayValuesProxy = undefined;
    // If we have a dataFrame we can allow referencing other columns and their values in the interpolation.
    if (dataFrame) {
        fieldDisplayValuesProxy = getFieldDisplayValuesProxy({
            frame: dataFrame,
            rowIndex,
        });
        scopedVars['__data'] = {
            value: {
                name: dataFrame.name,
                refId: dataFrame.refId,
                fields: fieldDisplayValuesProxy,
            },
            text: 'Data',
        };
        dataFrame.fields.forEach((f) => {
            if (fieldDisplayValuesProxy && fieldDisplayValuesProxy[f.name]) {
                scopedVars[f.name] = {
                    value: fieldDisplayValuesProxy[f.name],
                };
            }
        });
        // add this for convenience
        scopedVars['__targetField'] = {
            value: fieldDisplayValuesProxy[field.name],
        };
    }
    const linksToProcess = options.linksToProcess || field.config.links;
    if (linksToProcess) {
        const links = linksToProcess.filter((link) => {
            return DATA_LINK_FILTERS.every((filter) => filter(link, scopedVars));
        });
        const fieldLinks = links.map((link) => {
            var _a, _b;
            if (!link.internal) {
                const replace = (value, vars) => getTemplateSrv().replace(value, Object.assign(Object.assign({}, vars), scopedVars));
                const linkModel = getLinkSrv().getDataLinkUIModel(link, replace, field);
                if (!linkModel.title) {
                    linkModel.title = getTitleFromHref(linkModel.href);
                }
                return linkModel;
            }
            else {
                let internalLinkSpecificVars = {};
                if ((_a = link.internal) === null || _a === void 0 ? void 0 : _a.transformations) {
                    (_b = link.internal) === null || _b === void 0 ? void 0 : _b.transformations.forEach((transformation) => {
                        let fieldValue;
                        if (transformation.field) {
                            const transformField = dataFrame === null || dataFrame === void 0 ? void 0 : dataFrame.fields.find((field) => field.name === transformation.field);
                            fieldValue = transformField === null || transformField === void 0 ? void 0 : transformField.values[rowIndex];
                        }
                        else {
                            fieldValue = field.values[rowIndex];
                        }
                        internalLinkSpecificVars = Object.assign(Object.assign({}, internalLinkSpecificVars), getTransformationVars(transformation, fieldValue, field.name));
                    });
                }
                const allVars = Object.assign(Object.assign({}, scopedVars), internalLinkSpecificVars);
                const variableData = getVariableUsageInfo(link, allVars);
                let variables = [];
                // if the link has no variables (static link), add it with the right key but an empty value so we know what field the static link is associated with
                if (variableData.variables.length === 0) {
                    const fieldName = field.name.toString();
                    variables.push({ variableName: fieldName, value: '', match: '' });
                }
                else {
                    variables = variableData.variables;
                }
                const splitFnWithTracking = (options) => {
                    reportInteraction(DATA_LINK_USAGE_KEY, {
                        origin: link.origin || DataLinkConfigOrigin.Datasource,
                        app: CoreApp.Explore,
                        internal: true,
                    });
                    splitOpenFn === null || splitOpenFn === void 0 ? void 0 : splitOpenFn(options);
                };
                if (variableData.allVariablesDefined) {
                    const internalLink = mapInternalLinkToExplore({
                        link,
                        internalLink: link.internal,
                        scopedVars: allVars,
                        range,
                        field,
                        // Don't track internal links without split view as they are used only in Dashboards
                        onClickFn: options.splitOpenFn ? (options) => splitFnWithTracking(options) : undefined,
                        replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
                    });
                    return Object.assign(Object.assign({}, internalLink), { variables: variables });
                }
                else {
                    return undefined;
                }
            }
        });
        return fieldLinks.filter((link) => !!link);
    }
    return [];
};
/**
 * @internal
 */
export function getTitleFromHref(href) {
    // The URL constructor needs the url to have protocol
    if (href.indexOf('://') < 0) {
        // Doesn't really matter what protocol we use.
        href = `http://${href}`;
    }
    let title;
    try {
        const parsedUrl = new URL(href);
        title = parsedUrl.hostname;
    }
    catch (_e) {
        // Should be good enough fallback, user probably did not input valid url.
        title = href;
    }
    return title;
}
/**
 * Hook that returns a function that can be used to retrieve all the links for a row. This returns all the links from
 * all the fields so is useful for visualisation where the whole row is represented as single clickable item like a
 * service map.
 */
export function useLinks(range, splitOpenFn) {
    return useCallback((dataFrame, rowIndex) => {
        return dataFrame.fields.flatMap((f) => {
            var _a, _b;
            if (((_a = f.config) === null || _a === void 0 ? void 0 : _a.links) && ((_b = f.config) === null || _b === void 0 ? void 0 : _b.links.length)) {
                return getFieldLinksForExplore({
                    field: f,
                    rowIndex: rowIndex,
                    range,
                    dataFrame,
                    splitOpenFn,
                });
            }
            else {
                return [];
            }
        });
    }, [range, splitOpenFn]);
}
// See https://grafana.com/docs/grafana/latest/dashboards/variables/add-template-variables/#global-variables
const builtInVariables = [
    '__from',
    '__to',
    '__interval',
    '__interval_ms',
    '__org',
    '__user',
    '__range',
    '__rate_interval',
    '__timeFilter',
    'timeFilter',
    // These are only applicable in dashboards so should not affect this for Explore
    // '__dashboard',
    //'__name',
];
/**
 * Use variable map from templateSrv to determine if all variables have values
 * @param query
 * @param scopedVars
 */
export function getVariableUsageInfo(query, scopedVars) {
    let variables = [];
    const replaceFn = getTemplateSrv().replace.bind(getTemplateSrv());
    // This adds info to the variables array while interpolating
    replaceFn(getStringsFromObject(query), scopedVars, undefined, variables);
    variables = uniqBy(variables, 'variableName');
    return {
        variables: variables,
        allVariablesDefined: variables
            // We filter out builtin variables as they should be always defined but sometimes only later, like
            // __range_interval which is defined in prometheus at query time.
            .filter((v) => !builtInVariables.includes(v.variableName))
            .every((variable) => variable.found),
    };
}
// Recursively get all strings from an object into a simple list with space as separator.
function getStringsFromObject(obj) {
    let acc = '';
    let k;
    for (k in obj) {
        if (typeof obj[k] === 'string') {
            acc += ' ' + obj[k];
        }
        else if (typeof obj[k] === 'object') {
            acc += ' ' + getStringsFromObject(obj[k]);
        }
    }
    return acc;
}
//# sourceMappingURL=links.js.map