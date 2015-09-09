///<reference path="../headers/require.d.ts" />
define(["require", "exports", './fileSearcher', "../components/panelmeta"], function (require, exports, FileSearcher) {
    var Base = (function () {
        function Base() {
            var test = new FileSearcher();
            test.getFiles();
        }
        Base.prototype.getName = function () {
            return "asd";
        };
        return Base;
    })();
    return Base;
});
//# sourceMappingURL=testCtrl.js.map