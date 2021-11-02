import { __assign } from "tslib";
import { omit } from 'lodash';
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { FieldType, TIME_SERIES_METRIC_FIELD_NAME, TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, } from '../../types/dataFrame';
import { isTimeSeries } from '../../dataframe/utils';
import { MutableDataFrame, sortDataFrame } from '../../dataframe';
import { ArrayVector } from '../../vector';
import { getFrameDisplayName } from '../../field/fieldState';
export var seriesToRowsTransformer = {
    id: DataTransformerID.seriesToRows,
    name: 'Series to rows',
    description: 'Combines multiple series into a single serie and appends a column with metric name per value.',
    defaultOptions: {},
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            var _a;
            if (!Array.isArray(data) || data.length <= 1) {
                return data;
            }
            if (!isTimeSeries(data)) {
                return data;
            }
            var timeFieldByIndex = {};
            var targetFields = new Set();
            var dataFrame = new MutableDataFrame();
            var metricField = {
                name: TIME_SERIES_METRIC_FIELD_NAME,
                values: new ArrayVector(),
                config: {},
                type: FieldType.string,
            };
            for (var frameIndex = 0; frameIndex < data.length; frameIndex++) {
                var frame = data[frameIndex];
                for (var fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
                    var field = frame.fields[fieldIndex];
                    if (field.type === FieldType.time) {
                        timeFieldByIndex[frameIndex] = fieldIndex;
                        if (!targetFields.has(TIME_SERIES_TIME_FIELD_NAME)) {
                            dataFrame.addField(copyFieldStructure(field, TIME_SERIES_TIME_FIELD_NAME));
                            dataFrame.addField(metricField);
                            targetFields.add(TIME_SERIES_TIME_FIELD_NAME);
                        }
                        continue;
                    }
                    if (!targetFields.has(TIME_SERIES_VALUE_FIELD_NAME)) {
                        dataFrame.addField(copyFieldStructure(field, TIME_SERIES_VALUE_FIELD_NAME));
                        targetFields.add(TIME_SERIES_VALUE_FIELD_NAME);
                    }
                }
            }
            for (var frameIndex = 0; frameIndex < data.length; frameIndex++) {
                var frame = data[frameIndex];
                for (var valueIndex = 0; valueIndex < frame.length; valueIndex++) {
                    var timeFieldIndex = timeFieldByIndex[frameIndex];
                    var valueFieldIndex = timeFieldIndex === 0 ? 1 : 0;
                    dataFrame.add((_a = {},
                        _a[TIME_SERIES_TIME_FIELD_NAME] = frame.fields[timeFieldIndex].values.get(valueIndex),
                        _a[TIME_SERIES_METRIC_FIELD_NAME] = getFrameDisplayName(frame),
                        _a[TIME_SERIES_VALUE_FIELD_NAME] = frame.fields[valueFieldIndex].values.get(valueIndex),
                        _a));
                }
            }
            return [sortDataFrame(dataFrame, 0, true)];
        }));
    }; },
};
var copyFieldStructure = function (field, name) {
    return __assign(__assign({}, omit(field, ['values', 'state', 'labels', 'config', 'name'])), { name: name, values: new ArrayVector(), config: __assign({}, omit(field.config, ['displayName', 'displayNameFromDS'])) });
};
//# sourceMappingURL=seriesToRows.js.map