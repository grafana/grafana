import { LiveChannelType } from '@grafana/data';
/**
 * Generic description of channels that support streams
 *
 * @alpha
 */
var LiveMeasurementsSupport = /** @class */ (function () {
    function LiveMeasurementsSupport() {
    }
    /**
     * Get the channel handler for the path, or throw an error if invalid
     */
    LiveMeasurementsSupport.prototype.getChannelConfig = function (path) {
        return {
            type: LiveChannelType.DataStream,
        };
    };
    return LiveMeasurementsSupport;
}());
export { LiveMeasurementsSupport };
//# sourceMappingURL=measurementsSupport.js.map