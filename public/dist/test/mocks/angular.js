var AngularJSMock = /** @class */ (function () {
    function AngularJSMock() {
        this.service = jest.fn();
        this.controller = jest.fn();
        this.directive = jest.fn();
    }
    AngularJSMock.prototype.module = function () {
        return this;
    };
    return AngularJSMock;
}());
export default AngularJSMock;
module.exports = AngularJSMock;
//# sourceMappingURL=angular.js.map