import { DataTransformerID } from './ids';
import { filterFramesTransformer } from './filter';
import { FrameMatcherID } from '../matchers/ids';
export var filterFramesByRefIdTransformer = {
    id: DataTransformerID.filterByRefId,
    name: 'Filter data by query refId',
    description: 'select a subset of results',
    defaultOptions: {},
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        var filterOptions = {};
        if (options.include) {
            filterOptions.include = {
                id: FrameMatcherID.byRefId,
                options: options.include,
            };
        }
        if (options.exclude) {
            filterOptions.exclude = {
                id: FrameMatcherID.byRefId,
                options: options.exclude,
            };
        }
        return source.pipe(filterFramesTransformer.operator(filterOptions));
    }; },
};
//# sourceMappingURL=filterByRefId.js.map