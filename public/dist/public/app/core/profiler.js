var Profiler = /** @class */ (function () {
    function Profiler() {
        this.panelsRendered = 0;
        this.enabled = undefined;
        this.$rootScope = undefined;
        this.window = undefined;
    }
    Profiler.prototype.init = function (config, $rootScope) {
        this.$rootScope = $rootScope;
        this.window = window;
        if (!this.enabled) {
            return;
        }
    };
    Profiler.prototype.renderingCompleted = function () {
        // add render counter to root scope
        // used by image renderer to know when panel has rendered
        this.panelsRendered += 1;
        // this window variable is used by backend rendering tools to know
        // all panels have completed rendering
        this.window.panelsRendered = this.panelsRendered;
    };
    return Profiler;
}());
export { Profiler };
var profiler = new Profiler();
export { profiler };
//# sourceMappingURL=profiler.js.map