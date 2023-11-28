import { without, each } from 'lodash';
import coreModule from 'app/angular/core_module';
// This service really just tracks a list of $timeout promises to give us a
// method for canceling them all when we need to
export class Timer {
    constructor($timeout) {
        this.$timeout = $timeout;
        this.timers = [];
    }
    register(promise) {
        this.timers.push(promise);
        return promise;
    }
    cancel(promise) {
        this.timers = without(this.timers, promise);
        this.$timeout.cancel(promise);
    }
    cancelAll() {
        each(this.timers, (t) => {
            this.$timeout.cancel(t);
        });
        this.timers = [];
    }
}
Timer.$inject = ['$timeout'];
coreModule.service('timer', Timer);
//# sourceMappingURL=timer.js.map