/**
 * Returns minimal time step from series time field
 * @param timeField
 */
export var getSeriesTimeStep = function (timeField) {
    var previousTime;
    var minTimeStep;
    var returnTimeStep = Number.MAX_VALUE;
    for (var i = 0; i < timeField.values.length; i++) {
        var currentTime = timeField.values.get(i);
        if (previousTime !== undefined) {
            var timeStep = currentTime - previousTime;
            if (minTimeStep === undefined) {
                returnTimeStep = timeStep;
            }
            if (timeStep < returnTimeStep) {
                returnTimeStep = timeStep;
            }
        }
        previousTime = currentTime;
    }
    return returnTimeStep;
};
/**
 * Checks if series time field has ms resolution
 * @param timeField
 */
export var hasMsResolution = function (timeField) {
    for (var i = 0; i < timeField.values.length; i++) {
        var value = timeField.values.get(i);
        if (value !== null && value !== undefined) {
            var timestamp = value.toString();
            if (timestamp.length === 13 && timestamp % 1000 !== 0) {
                return true;
            }
        }
    }
    return false;
};
//# sourceMappingURL=series.js.map