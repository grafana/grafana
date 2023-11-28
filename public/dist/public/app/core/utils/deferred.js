export class Deferred {
    constructor() {
        this.resolve = undefined;
        this.reject = undefined;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
        Object.freeze(this);
    }
}
//# sourceMappingURL=deferred.js.map