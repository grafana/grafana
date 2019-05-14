import _ from 'lodash';
import coreModule from 'app/core/core_module';
// This service really just tracks a list of $timeout promises to give us a
// method for canceling them all when we need to
var Timer = /** @class */ (function () {
    /** @ngInject */
    function Timer($timeout) {
        this.$timeout = $timeout;
        this.timers = [];
    }
    Timer.prototype.register = function (promise) {
        this.timers.push(promise);
        return promise;
    };
    Timer.prototype.cancel = function (promise) {
        this.timers = _.without(this.timers, promise);
        this.$timeout.cancel(promise);
    };
    Timer.prototype.cancelAll = function () {
        var _this = this;
        _.each(this.timers, function (t) {
            _this.$timeout.cancel(t);
        });
        this.timers = [];
    };
    return Timer;
}());
export { Timer };
coreModule.service('timer', Timer);
//# sourceMappingURL=timer.js.map