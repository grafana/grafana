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
      link: (scope: any, elem) => {
        let expansionLevel = scope.startExpanded;
        if (scope.startExpanded === 'true') {
          expansionLevel = 2;
        } else if (scope.startExpanded === 'false') {
          expansionLevel = 1;
        }
        const jsonObject = { [scope.rootName]: scope.object };
        const jsonExp = new JsonExplorer(jsonObject, expansionLevel, {
          animateOpen: true,
        });
        const html = jsonExp.render(true);
        elem.append(html);
      },
    };
  },
]);
