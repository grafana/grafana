import { DataTransformerID } from './ids';
import { orderFieldsTransformer } from './order';
import { filterFieldsByNameTransformer } from './filterByName';
import { renameFieldsTransformer } from './rename';
export var organizeFieldsTransformer = {
    id: DataTransformerID.organize,
    name: 'Organize fields by name',
    description: 'Order, filter and rename fields based on configuration given by user',
    defaultOptions: {
        excludeByName: {},
        indexByName: {},
        renameByName: {},
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(filterFieldsByNameTransformer.operator({
            exclude: { names: mapToExcludeArray(options.excludeByName) },
        }), orderFieldsTransformer.operator(options), renameFieldsTransformer.operator(options));
    }; },
};
var mapToExcludeArray = function (excludeByName) {
    if (!excludeByName) {
        return [];
    }
    return Object.keys(excludeByName).filter(function (name) { return excludeByName[name]; });
};
//# sourceMappingURL=organize.js.map