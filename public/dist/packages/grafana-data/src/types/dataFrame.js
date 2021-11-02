/** @public */
export var FieldType;
(function (FieldType) {
    FieldType["time"] = "time";
    FieldType["number"] = "number";
    FieldType["string"] = "string";
    FieldType["boolean"] = "boolean";
    // Used to detect that the value is some kind of trace data to help with the visualisation and processing.
    FieldType["trace"] = "trace";
    FieldType["other"] = "other";
})(FieldType || (FieldType = {}));
export var TIME_SERIES_VALUE_FIELD_NAME = 'Value';
export var TIME_SERIES_TIME_FIELD_NAME = 'Time';
export var TIME_SERIES_METRIC_FIELD_NAME = 'Metric';
//# sourceMappingURL=dataFrame.js.map