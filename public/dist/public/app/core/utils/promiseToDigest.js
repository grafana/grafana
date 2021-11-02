export var promiseToDigest = function ($scope) { return function (promise) { return promise.finally($scope.$evalAsync); }; };
//# sourceMappingURL=promiseToDigest.js.map