var Deferred = /** @class */ (function () {
    function Deferred() {
        var _this = this;
        this.resolve = undefined;
        this.reject = undefined;
        this.promise = new Promise(function (resolve, reject) {
            _this.resolve = resolve;
            _this.reject = reject;
        });
        Object.freeze(this);
    }
    return Deferred;
}());
export { Deferred };
//# sourceMappingURL=deferred.js.map