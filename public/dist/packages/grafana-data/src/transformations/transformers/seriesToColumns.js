import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { outerJoinDataFrames } from './joinDataFrames';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
export var seriesToColumnsTransformer = {
    id: DataTransformerID.seriesToColumns,
    name: 'Series as columns',
    description: 'Groups series by field and returns values as columns',
    defaultOptions: {
        byField: undefined, // DEFAULT_KEY_FIELD,
    },
    operator: function (options) { return function (source) { return source.pipe(map(function (data) { return seriesToColumnsTransformer.transformer(options)(data); })); }; },
    transformer: function (options) {
        var joinBy = undefined;
        return function (data) {
            if (data.length > 1) {
                if (options.byField && !joinBy) {
                    joinBy = fieldMatchers.get(FieldMatcherID.byName).get(options.byField);
                }
                var joined = outerJoinDataFrames({ frames: data, joinBy: joinBy });
                if (joined) {
                    return [joined];
                }
            }
            return data;
        };
    },
};
//# sourceMappingURL=seriesToColumns.js.map