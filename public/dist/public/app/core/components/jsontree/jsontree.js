import coreModule from 'app/core/core_module';
import { JsonExplorer } from '@grafana/ui';
coreModule.directive('jsonTree', [
    function jsonTreeDirective() {
        return {
            restrict: 'E',
            scope: {
                object: '=',
                startExpanded: '@',
                rootName: '@',
            },
            link: function (scope, elem) {
                var _a;
                var expansionLevel = scope.startExpanded;
                if (scope.startExpanded === 'true') {
                    expansionLevel = 2;
                }
                else if (scope.startExpanded === 'false') {
                    expansionLevel = 1;
                }
                var jsonObject = (_a = {}, _a[scope.rootName] = scope.object, _a);
                var jsonExp = new JsonExplorer(jsonObject, expansionLevel, {
                    animateOpen: true,
                });
                var html = jsonExp.render(true);
                elem.append(html);
            },
        };
    },
]);
//# sourceMappingURL=jsontree.js.map