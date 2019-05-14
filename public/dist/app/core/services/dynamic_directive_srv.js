import angular from 'angular';
import coreModule from '../core_module';
var DynamicDirectiveSrv = /** @class */ (function () {
    /** @ngInject */
    function DynamicDirectiveSrv($compile) {
        this.$compile = $compile;
    }
    DynamicDirectiveSrv.prototype.addDirective = function (element, name, scope) {
        var child = angular.element(document.createElement(name));
        this.$compile(child)(scope);
        element.empty();
        element.append(child);
    };
    DynamicDirectiveSrv.prototype.link = function (scope, elem, attrs, options) {
        var directiveInfo = options.directive(scope);
        if (!directiveInfo || !directiveInfo.fn) {
            elem.empty();
            return;
        }
        if (!directiveInfo.fn.registered) {
            coreModule.directive(attrs.$normalize(directiveInfo.name), directiveInfo.fn);
            directiveInfo.fn.registered = true;
        }
        this.addDirective(elem, directiveInfo.name, scope);
    };
    DynamicDirectiveSrv.prototype.create = function (options) {
        var _this = this;
        var directiveDef = {
            restrict: 'E',
            scope: options.scope,
            link: function (scope, elem, attrs) {
                if (options.watchPath) {
                    var childScope_1 = null;
                    scope.$watch(options.watchPath, function () {
                        if (childScope_1) {
                            childScope_1.$destroy();
                        }
                        childScope_1 = scope.$new();
                        _this.link(childScope_1, elem, attrs, options);
                    });
                }
                else {
                    _this.link(scope, elem, attrs, options);
                }
            },
        };
        return directiveDef;
    };
    return DynamicDirectiveSrv;
}());
coreModule.service('dynamicDirectiveSrv', DynamicDirectiveSrv);
//# sourceMappingURL=dynamic_directive_srv.js.map