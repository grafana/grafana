import { __assign, __values } from "tslib";
import { default as GraphiteQueryModel } from '../../graphite/graphite_query';
import { map } from 'lodash';
import { getTemplateSrv } from '../../../../features/templating/template_srv';
var GRAPHITE_TO_LOKI_OPERATOR = {
    '=': '=',
    '!=': '!=',
    '=~': '=~',
    '!=~': '!~',
};
/**
 * Converts Graphite glob-like pattern to a regular expression
 */
function convertGlobToRegEx(text) {
    if (text.includes('*') || text.includes('{')) {
        return '^' + text.replace(/\*/g, '.*').replace(/\{/g, '(').replace(/}/g, ')').replace(/,/g, '|');
    }
    else {
        return text;
    }
}
export default function fromGraphiteQueries(graphiteQueries, graphiteDataSource) {
    return graphiteQueries.map(function (query) {
        var model = new GraphiteQueryModel(graphiteDataSource, __assign(__assign({}, query), { target: query.target || '', textEditor: false }), getTemplateSrv());
        model.parseTarget();
        return {
            refId: query.refId,
            expr: fromGraphite(model, graphiteDataSource.getImportQueryConfiguration().loki),
        };
    });
}
function fromGraphite(graphiteQuery, config) {
    var e_1, _a;
    var matchingFound = false;
    var labels = {};
    if (graphiteQuery.seriesByTagUsed) {
        matchingFound = true;
        graphiteQuery.tags.forEach(function (tag) {
            labels[tag.key] = {
                value: tag.value,
                operator: GRAPHITE_TO_LOKI_OPERATOR[tag.operator],
            };
        });
    }
    else {
        var targetNodes_1 = graphiteQuery.segments.map(function (segment) { return segment.value; });
        var mappings = config.mappings.filter(function (mapping) { return mapping.matchers.length <= targetNodes_1.length; });
        try {
            for (var mappings_1 = __values(mappings), mappings_1_1 = mappings_1.next(); !mappings_1_1.done; mappings_1_1 = mappings_1.next()) {
                var mapping = mappings_1_1.value;
                var matchers = mapping.matchers.concat();
                matchingFound = matchers.every(function (matcher, index) {
                    if (matcher.labelName) {
                        var value = targetNodes_1[index];
                        if (value === '*') {
                            return true;
                        }
                        var converted = convertGlobToRegEx(value);
                        labels[matcher.labelName] = {
                            value: converted,
                            operator: converted !== value ? '=~' : '=',
                        };
                        return true;
                    }
                    return targetNodes_1[index] === matcher.value || matcher.value === '*';
                });
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (mappings_1_1 && !mappings_1_1.done && (_a = mappings_1.return)) _a.call(mappings_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    var pairs = map(labels, function (value, key) { return "" + key + value.operator + "\"" + value.value + "\""; });
    if (matchingFound && pairs.length) {
        return "{" + pairs.join(', ') + "}";
    }
    else {
        return '';
    }
}
//# sourceMappingURL=fromGraphite.js.map