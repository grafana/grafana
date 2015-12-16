var find_support_1 = require('./find-support');
function find(predicate, thisArg) {
    if (typeof predicate !== 'function') {
        throw new TypeError('predicate is not a function');
    }
    return this.lift(new find_support_1.FindValueOperator(predicate, this, false, thisArg));
}
exports.find = find;
//# sourceMappingURL=find.js.map