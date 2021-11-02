/**
 * Datasource mock for influx. At the moment this only works for queries that should return measurements or their
 * fields and no other functionality is implemented.
 */
var InfluxDatasourceMock = /** @class */ (function () {
    function InfluxDatasourceMock(measurements) {
        this.measurements = measurements;
    }
    InfluxDatasourceMock.prototype.metricFindQuery = function (query) {
        if (isMeasurementsQuery(query)) {
            return this.getMeasurements();
        }
        else {
            return this.getMeasurementFields(query);
        }
    };
    InfluxDatasourceMock.prototype.getMeasurements = function () {
        return Object.keys(this.measurements).map(function (key) { return ({ text: key }); });
    };
    InfluxDatasourceMock.prototype.getMeasurementFields = function (query) {
        var match = query.match(/SHOW FIELD KEYS FROM \"(.+)\"/);
        if (!match) {
            throw new Error("Failed to match query=\"" + query + "\"");
        }
        var measurementName = match[1];
        if (!measurementName) {
            throw new Error("Failed to match measurement name from query=\"" + query + "\"");
        }
        var fields = this.measurements[measurementName];
        if (!fields) {
            throw new Error("Failed to find measurement with name=\"" + measurementName + "\" in measurements=\"[" + Object.keys(this.measurements).join(', ') + "]\"");
        }
        return fields.map(function (field) { return ({
            text: field.name,
        }); });
    };
    return InfluxDatasourceMock;
}());
export { InfluxDatasourceMock };
function isMeasurementsQuery(query) {
    return /SHOW MEASUREMENTS/.test(query);
}
//# sourceMappingURL=datasource.mock.js.map