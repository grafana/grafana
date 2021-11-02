// this helper class is used to make typescript warn you when you forget
// a case-block in a switch statement.
// example code that triggers the typescript-error:
//
// const x:'A'|'B'|'C' = 'A';
//
// switch(x) {
//   case 'A':
//     // something
//   case 'B':
//     // something
//   default:
//     throw new NeverCaseError(x);
// }
//
//
// typescript will show an error in this case,
// when you add the missing `case 'C'` code,
// the problem will be fixed.
import { __extends } from "tslib";
var NeverCaseError = /** @class */ (function (_super) {
    __extends(NeverCaseError, _super);
    function NeverCaseError(value) {
        return _super.call(this, 'should never happen') || this;
    }
    return NeverCaseError;
}(Error));
export { NeverCaseError };
//# sourceMappingURL=util.js.map