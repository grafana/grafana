import { DataTransformerID } from './ids';
import { FieldMatcherID } from '../matchers/ids';
import { filterFieldsTransformer } from './filter';
export var filterFieldsByNameTransformer = {
    id: DataTransformerID.filterFieldsByName,
    name: 'Filter fields by name',
    description: 'select a subset of fields',
    defaultOptions: {},
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(filterFieldsTransformer.operator({
            include: getMatcherConfig(options.include),
            exclude: getMatcherConfig(options.exclude),
        }));
    }; },
};
var getMatcherConfig = function (options) {
    if (!options) {
        return undefined;
    }
    var names = options.names, pattern = options.pattern;
    if ((!Array.isArray(names) || names.length === 0) && !pattern) {
        return undefined;
    }
    if (!pattern) {
        return { id: FieldMatcherID.byNames, options: { names: names } };
    }
    if (!Array.isArray(names) || names.length === 0) {
        return { id: FieldMatcherID.byRegexp, options: pattern };
    }
    return { id: FieldMatcherID.byRegexpOrNames, options: options };
};
//# sourceMappingURL=filterByName.js.map