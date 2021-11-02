/**
 * @beta
 * Proxies a ES6 class so that it can be used as a base class for an ES5 class
 */
export function makeClassES5Compatible(ES6Class) {
    return new Proxy(ES6Class, {
        // ES5 code will call it like a function using super
        apply: function (target, self, argumentsList) {
            if (typeof Reflect === 'undefined' || !Reflect.construct) {
                alert('Browser is too old');
            }
            return Reflect.construct(target, argumentsList, self.constructor);
        },
    });
}
//# sourceMappingURL=makeClassES5Compatible.js.map