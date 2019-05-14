import moment from 'moment';
var LogAnalyticsQuerystringBuilder = /** @class */ (function () {
    function LogAnalyticsQuerystringBuilder(rawQueryString, options, defaultTimeField) {
        this.rawQueryString = rawQueryString;
        this.options = options;
        this.defaultTimeField = defaultTimeField;
    }
    LogAnalyticsQuerystringBuilder.prototype.generate = function () {
        var _this = this;
        var queryString = this.rawQueryString;
        var macroRegexp = /\$__([_a-zA-Z0-9]+)\(([^\)]*)\)/gi;
        queryString = queryString.replace(macroRegexp, function (match, p1, p2) {
            if (p1 === 'contains') {
                return _this.getMultiContains(p2);
            }
            return match;
        });
        queryString = queryString.replace(/\$__escapeMulti\(('[^]*')\)/gi, function (match, p1) { return _this.escape(p1); });
        if (this.options) {
            queryString = queryString.replace(macroRegexp, function (match, p1, p2) {
                if (p1 === 'timeFilter') {
                    return _this.getTimeFilter(p2, _this.options);
                }
                return match;
            });
            queryString = queryString.replace(/\$__interval/gi, this.options.interval);
            queryString = queryString.replace(/\$__from/gi, this.getFrom(this.options));
            queryString = queryString.replace(/\$__to/gi, this.getUntil(this.options));
        }
        var rawQuery = queryString;
        queryString = encodeURIComponent(queryString);
        var uriString = "query=" + queryString;
        return { uriString: uriString, rawQuery: rawQuery };
    };
    LogAnalyticsQuerystringBuilder.prototype.getFrom = function (options) {
        var from = options.range.from;
        return "datetime(" + moment(from)
            .startOf('minute')
            .toISOString() + ")";
    };
    LogAnalyticsQuerystringBuilder.prototype.getUntil = function (options) {
        if (options.rangeRaw.to === 'now') {
            return 'now()';
        }
        else {
            var until = options.range.to;
            return "datetime(" + moment(until)
                .startOf('minute')
                .toISOString() + ")";
        }
    };
    LogAnalyticsQuerystringBuilder.prototype.getTimeFilter = function (timeFieldArg, options) {
        var timeField = timeFieldArg || this.defaultTimeField;
        if (options.rangeRaw.to === 'now') {
            return timeField + " >= " + this.getFrom(options);
        }
        else {
            return timeField + "  >= " + this.getFrom(options) + " and " + timeField + " <= " + this.getUntil(options);
        }
    };
    LogAnalyticsQuerystringBuilder.prototype.getMultiContains = function (inputs) {
        var firstCommaIndex = inputs.indexOf(',');
        var field = inputs.substring(0, firstCommaIndex);
        var templateVar = inputs.substring(inputs.indexOf(',') + 1);
        if (templateVar && templateVar.toLowerCase().trim() === 'all') {
            return '1 == 1';
        }
        return field.trim() + " in (" + templateVar.trim() + ")";
    };
    LogAnalyticsQuerystringBuilder.prototype.escape = function (inputs) {
        return inputs
            .substring(1, inputs.length - 1)
            .split("','")
            .map(function (v) { return "@'" + v + "'"; })
            .join(', ');
    };
    return LogAnalyticsQuerystringBuilder;
}());
export default LogAnalyticsQuerystringBuilder;
//# sourceMappingURL=querystring_builder.js.map