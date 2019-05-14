import TimeGrainConverter from '../time_grain_converter';
var AppInsightsQuerystringBuilder = /** @class */ (function () {
    function AppInsightsQuerystringBuilder(from, to, grafanaInterval) {
        this.from = from;
        this.to = to;
        this.grafanaInterval = grafanaInterval;
        this.aggregation = '';
        this.groupBy = '';
        this.timeGrainType = '';
        this.timeGrain = '';
        this.timeGrainUnit = '';
        this.filter = '';
    }
    AppInsightsQuerystringBuilder.prototype.setAggregation = function (aggregation) {
        this.aggregation = aggregation;
    };
    AppInsightsQuerystringBuilder.prototype.setGroupBy = function (groupBy) {
        this.groupBy = groupBy;
    };
    AppInsightsQuerystringBuilder.prototype.setInterval = function (timeGrainType, timeGrain, timeGrainUnit) {
        this.timeGrainType = timeGrainType;
        this.timeGrain = timeGrain;
        this.timeGrainUnit = timeGrainUnit;
    };
    AppInsightsQuerystringBuilder.prototype.setFilter = function (filter) {
        this.filter = filter;
    };
    AppInsightsQuerystringBuilder.prototype.generate = function () {
        var querystring = "timespan=" + this.from.utc().format() + "/" + this.to.utc().format();
        if (this.aggregation && this.aggregation.length > 0) {
            querystring += "&aggregation=" + this.aggregation;
        }
        if (this.groupBy && this.groupBy.length > 0) {
            querystring += "&segment=" + this.groupBy;
        }
        if (this.timeGrainType === 'specific' && this.timeGrain && this.timeGrainUnit) {
            querystring += "&interval=" + TimeGrainConverter.createISO8601Duration(this.timeGrain, this.timeGrainUnit);
        }
        if (this.timeGrainType === 'auto') {
            querystring += "&interval=" + TimeGrainConverter.createISO8601DurationFromInterval(this.grafanaInterval);
        }
        if (this.filter) {
            querystring += "&filter=" + this.filter;
        }
        return querystring;
    };
    return AppInsightsQuerystringBuilder;
}());
export default AppInsightsQuerystringBuilder;
//# sourceMappingURL=app_insights_querystring_builder.js.map