import { locationUtil } from './location';
import { serializeStateToUrlParam } from './url';
export var DataLinkBuiltInVars = {
    keepTime: '__url_time_range',
    timeRangeFrom: '__from',
    timeRangeTo: '__to',
    includeVars: '__all_variables',
    seriesName: '__series.name',
    fieldName: '__field.name',
    valueTime: '__value.time',
    valueNumeric: '__value.numeric',
    valueText: '__value.text',
    valueRaw: '__value.raw',
    // name of the calculation represented by the value
    valueCalc: '__value.calc',
};
export function mapInternalLinkToExplore(options) {
    var onClickFn = options.onClickFn, replaceVariables = options.replaceVariables, link = options.link, scopedVars = options.scopedVars, range = options.range, field = options.field, internalLink = options.internalLink;
    var interpolatedQuery = interpolateQuery(link, scopedVars, replaceVariables);
    var title = link.title ? link.title : internalLink.datasourceName;
    return {
        title: replaceVariables(title, scopedVars),
        // In this case this is meant to be internal link (opens split view by default) the href will also points
        // to explore but this way you can open it in new tab.
        href: generateInternalHref(internalLink.datasourceName, interpolatedQuery, range),
        onClick: onClickFn
            ? function () {
                onClickFn({
                    datasourceUid: internalLink.datasourceUid,
                    query: interpolatedQuery,
                    range: range,
                });
            }
            : undefined,
        target: '_self',
        origin: field,
    };
}
/**
 * Generates href for internal derived field link.
 */
function generateInternalHref(datasourceName, query, range) {
    return locationUtil.assureBaseUrl("/explore?left=" + encodeURIComponent(serializeStateToUrlParam({
        range: range.raw,
        datasource: datasourceName,
        queries: [query],
    })));
}
function interpolateQuery(link, scopedVars, replaceVariables) {
    var _a;
    var stringifiedQuery = '';
    try {
        stringifiedQuery = JSON.stringify(((_a = link.internal) === null || _a === void 0 ? void 0 : _a.query) || '');
    }
    catch (err) {
        // should not happen and not much to do about this, possibly something non stringifiable in the query
        console.error(err);
    }
    // Replace any variables inside the query. This may not be the safest as it can also replace keys etc so may not
    // actually work with every datasource query right now.
    stringifiedQuery = replaceVariables(stringifiedQuery, scopedVars);
    var replacedQuery = {};
    try {
        replacedQuery = JSON.parse(stringifiedQuery);
    }
    catch (err) {
        // again should not happen and not much to do about this, probably some issue with how we replaced the variables.
        console.error(stringifiedQuery, err);
    }
    return replacedQuery;
}
//# sourceMappingURL=dataLinks.js.map