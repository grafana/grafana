import { __assign, __read, __spreadArray } from "tslib";
import { useCallback } from 'react';
import { mapInternalLinkToExplore, getFieldDisplayValuesProxy, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getLinkSrv } from '../../../angular/panel/panellinks/link_srv';
import { contextSrv } from 'app/core/services/context_srv';
/**
 * Get links from the field of a dataframe and in addition check if there is associated
 * metadata with datasource in which case we will add onClick to open the link in new split window. This assumes
 * that we just supply datasource name and field value and Explore split window will know how to render that
 * appropriately. This is for example used for transition from log with traceId to trace datasource to show that
 * trace.
 */
export var getFieldLinksForExplore = function (options) {
    var field = options.field, vars = options.vars, splitOpenFn = options.splitOpenFn, range = options.range, rowIndex = options.rowIndex, dataFrame = options.dataFrame;
    var scopedVars = __assign({}, (vars || {}));
    scopedVars['__value'] = {
        value: {
            raw: field.values.get(rowIndex),
        },
        text: 'Raw value',
    };
    // If we have a dataFrame we can allow referencing other columns and their values in the interpolation.
    if (dataFrame) {
        scopedVars['__data'] = {
            value: {
                name: dataFrame.name,
                refId: dataFrame.refId,
                fields: getFieldDisplayValuesProxy({
                    frame: dataFrame,
                    rowIndex: rowIndex,
                }),
            },
            text: 'Data',
        };
    }
    if (field.config.links) {
        var links = [];
        if (!contextSrv.hasAccessToExplore()) {
            links.push.apply(links, __spreadArray([], __read(field.config.links.filter(function (l) { return !l.internal; })), false));
        }
        else {
            links.push.apply(links, __spreadArray([], __read(field.config.links), false));
        }
        return links.map(function (link) {
            if (!link.internal) {
                var replace = function (value, vars) {
                    return getTemplateSrv().replace(value, __assign(__assign({}, vars), scopedVars));
                };
                var linkModel = getLinkSrv().getDataLinkUIModel(link, replace, field);
                if (!linkModel.title) {
                    linkModel.title = getTitleFromHref(linkModel.href);
                }
                return linkModel;
            }
            else {
                return mapInternalLinkToExplore({
                    link: link,
                    internalLink: link.internal,
                    scopedVars: scopedVars,
                    range: range,
                    field: field,
                    onClickFn: splitOpenFn,
                    replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
                });
            }
        });
    }
    return [];
};
function getTitleFromHref(href) {
    // The URL constructor needs the url to have protocol
    if (href.indexOf('://') < 0) {
        // Doesn't really matter what protocol we use.
        href = "http://" + href;
    }
    var title;
    try {
        var parsedUrl = new URL(href);
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
    return useCallback(function (dataFrame, rowIndex) {
        return dataFrame.fields.flatMap(function (f) {
            var _a, _b;
            if (((_a = f.config) === null || _a === void 0 ? void 0 : _a.links) && ((_b = f.config) === null || _b === void 0 ? void 0 : _b.links.length)) {
                return getFieldLinksForExplore({
                    field: f,
                    rowIndex: rowIndex,
                    range: range,
                    dataFrame: dataFrame,
                    splitOpenFn: splitOpenFn,
                });
            }
            else {
                return [];
            }
        });
    }, [range, splitOpenFn]);
}
//# sourceMappingURL=links.js.map