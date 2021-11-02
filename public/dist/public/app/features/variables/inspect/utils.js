import { __assign, __values } from "tslib";
import { variableAdapters } from '../adapters';
import { isAdHoc } from '../guard';
import { safeStringifyValue } from '../../../core/utils/explore';
import { containsVariable, variableRegex, variableRegexExec } from '../utils';
export var createDependencyNodes = function (variables) {
    var e_1, _a;
    var nodes = [];
    try {
        for (var variables_1 = __values(variables), variables_1_1 = variables_1.next(); !variables_1_1.done; variables_1_1 = variables_1.next()) {
            var variable = variables_1_1.value;
            nodes.push({ id: variable.id, label: "" + variable.id });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (variables_1_1 && !variables_1_1.done && (_a = variables_1.return)) _a.call(variables_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return nodes;
};
export var filterNodesWithDependencies = function (nodes, edges) {
    return nodes.filter(function (node) { return edges.some(function (edge) { return edge.from === node.id || edge.to === node.id; }); });
};
export var createDependencyEdges = function (variables) {
    var e_2, _a, e_3, _b;
    var edges = [];
    try {
        for (var variables_2 = __values(variables), variables_2_1 = variables_2.next(); !variables_2_1.done; variables_2_1 = variables_2.next()) {
            var variable = variables_2_1.value;
            try {
                for (var variables_3 = (e_3 = void 0, __values(variables)), variables_3_1 = variables_3.next(); !variables_3_1.done; variables_3_1 = variables_3.next()) {
                    var other = variables_3_1.value;
                    if (variable === other) {
                        continue;
                    }
                    var dependsOn = variableAdapters.get(variable.type).dependsOn(variable, other);
                    if (dependsOn) {
                        edges.push({ from: variable.id, to: other.id });
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (variables_3_1 && !variables_3_1.done && (_b = variables_3.return)) _b.call(variables_3);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (variables_2_1 && !variables_2_1.done && (_a = variables_2.return)) _a.call(variables_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return edges;
};
function getVariableName(expression) {
    var match = variableRegexExec(expression);
    if (!match) {
        return null;
    }
    var variableName = match.slice(1).find(function (match) { return match !== undefined; });
    return variableName;
}
export var getUnknownVariableStrings = function (variables, model) {
    var e_4, _a;
    variableRegex.lastIndex = 0;
    var unknownVariableNames = [];
    var modelAsString = safeStringifyValue(model, 2);
    var matches = modelAsString.match(variableRegex);
    if (!matches) {
        return unknownVariableNames;
    }
    var _loop_1 = function (match) {
        if (!match) {
            return "continue";
        }
        if (match.indexOf('$__') !== -1) {
            return "continue";
        }
        if (match.indexOf('${__') !== -1) {
            return "continue";
        }
        if (match.indexOf('$hashKey') !== -1) {
            return "continue";
        }
        var variableName = getVariableName(match);
        if (variables.some(function (variable) { return variable.id === variableName; })) {
            return "continue";
        }
        if (unknownVariableNames.find(function (name) { return name === variableName; })) {
            return "continue";
        }
        if (variableName) {
            unknownVariableNames.push(variableName);
        }
    };
    try {
        for (var matches_1 = __values(matches), matches_1_1 = matches_1.next(); !matches_1_1.done; matches_1_1 = matches_1.next()) {
            var match = matches_1_1.value;
            _loop_1(match);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (matches_1_1 && !matches_1_1.done && (_a = matches_1.return)) _a.call(matches_1);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return unknownVariableNames;
};
var validVariableNames = {
    alias: [/^m$/, /^measurement$/, /^col$/, /^tag_\w+|\d+$/],
    query: [/^timeFilter$/],
};
export var getPropsWithVariable = function (variableId, parent, result) {
    var stringValues = Object.keys(parent.value).reduce(function (all, key) {
        var _a;
        var value = parent.value[key];
        if (!value || typeof value !== 'string') {
            return all;
        }
        var isValidName = validVariableNames[key]
            ? validVariableNames[key].find(function (regex) { return regex.test(variableId); })
            : undefined;
        var hasVariable = containsVariable(value, variableId);
        if (!isValidName && hasVariable) {
            all = __assign(__assign({}, all), (_a = {}, _a[key] = value, _a));
        }
        return all;
    }, {});
    var objectValues = Object.keys(parent.value).reduce(function (all, key) {
        var _a;
        var value = parent.value[key];
        if (value && typeof value === 'object' && Object.keys(value).length) {
            var id = value.title || value.name || value.id || key;
            var newResult = getPropsWithVariable(variableId, { key: key, value: value }, {});
            if (Object.keys(newResult).length) {
                all = __assign(__assign({}, all), (_a = {}, _a[id] = newResult, _a));
            }
        }
        return all;
    }, {});
    if (Object.keys(stringValues).length || Object.keys(objectValues).length) {
        result = __assign(__assign(__assign({}, result), stringValues), objectValues);
    }
    return result;
};
export var createUsagesNetwork = function (variables, dashboard) {
    var e_5, _a, e_6, _b;
    if (!dashboard) {
        return { unUsed: [], unknown: [], usages: [] };
    }
    var unUsed = [];
    var usages = [];
    var unknown = [];
    var model = dashboard.getSaveModelClone();
    var unknownVariables = getUnknownVariableStrings(variables, model);
    try {
        for (var unknownVariables_1 = __values(unknownVariables), unknownVariables_1_1 = unknownVariables_1.next(); !unknownVariables_1_1.done; unknownVariables_1_1 = unknownVariables_1.next()) {
            var unknownVariable = unknownVariables_1_1.value;
            var props = getPropsWithVariable(unknownVariable, { key: 'model', value: model }, {});
            if (Object.keys(props).length) {
                var variable = { id: unknownVariable, name: unknownVariable };
                unknown.push({ variable: variable, tree: props });
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (unknownVariables_1_1 && !unknownVariables_1_1.done && (_a = unknownVariables_1.return)) _a.call(unknownVariables_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    try {
        for (var variables_4 = __values(variables), variables_4_1 = variables_4.next(); !variables_4_1.done; variables_4_1 = variables_4.next()) {
            var variable = variables_4_1.value;
            var variableId = variable.id;
            var props = getPropsWithVariable(variableId, { key: 'model', value: model }, {});
            if (!Object.keys(props).length && !isAdHoc(variable)) {
                unUsed.push(variable);
            }
            if (Object.keys(props).length) {
                usages.push({ variable: variable, tree: props });
            }
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (variables_4_1 && !variables_4_1.done && (_b = variables_4.return)) _b.call(variables_4);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return { unUsed: unUsed, unknown: unknown, usages: usages };
};
export var traverseTree = function (usage, parent) {
    var e_7, _a;
    var id = parent.id, value = parent.value;
    var nodes = usage.nodes, edges = usage.edges;
    if (value && typeof value === 'string') {
        var leafId = parent.id + "-" + value;
        nodes.push({ id: leafId, label: value });
        edges.push({ from: leafId, to: id });
        return usage;
    }
    if (value && typeof value === 'object') {
        var keys = Object.keys(value);
        try {
            for (var keys_1 = __values(keys), keys_1_1 = keys_1.next(); !keys_1_1.done; keys_1_1 = keys_1.next()) {
                var key = keys_1_1.value;
                var leafId = parent.id + "-" + key;
                nodes.push({ id: leafId, label: key });
                edges.push({ from: leafId, to: id });
                usage = traverseTree(usage, { id: leafId, value: value[key] });
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (keys_1_1 && !keys_1_1.done && (_a = keys_1.return)) _a.call(keys_1);
            }
            finally { if (e_7) throw e_7.error; }
        }
        return usage;
    }
    return usage;
};
export var transformUsagesToNetwork = function (usages) {
    var e_8, _a;
    var results = [];
    try {
        for (var usages_1 = __values(usages), usages_1_1 = usages_1.next(); !usages_1_1.done; usages_1_1 = usages_1.next()) {
            var usage = usages_1_1.value;
            var variable = usage.variable, tree = usage.tree;
            var result = {
                variable: variable,
                nodes: [{ id: 'dashboard', label: 'dashboard' }],
                edges: [],
                showGraph: false,
            };
            results.push(traverseTree(result, { id: 'dashboard', value: tree }));
        }
    }
    catch (e_8_1) { e_8 = { error: e_8_1 }; }
    finally {
        try {
            if (usages_1_1 && !usages_1_1.done && (_a = usages_1.return)) _a.call(usages_1);
        }
        finally { if (e_8) throw e_8.error; }
    }
    return results;
};
var countLeaves = function (object) {
    var total = Object.values(object).reduce(function (count, value) {
        if (typeof value === 'object') {
            return count + countLeaves(value);
        }
        return count + 1;
    }, 0);
    return total;
};
export var getVariableUsages = function (variableId, usages) {
    var usage = usages.find(function (usage) { return usage.variable.id === variableId; });
    if (!usage) {
        return 0;
    }
    return countLeaves(usage.tree);
};
//# sourceMappingURL=utils.js.map