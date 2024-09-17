import $ from 'jquery';

import coreModule from './core_module';

function getBlockNodes(nodes: any[]) {
  let node = nodes[0];
  const endNode = nodes[nodes.length - 1];
  let blockNodes: any[] | undefined;
  node = node.nextSibling;

  for (let i = 1; node !== endNode && node; i++) {
    if (blockNodes || nodes[i] !== node) {
      if (!blockNodes) {
        blockNodes = $([].slice.call(nodes, 0, i)) as any;
      }

      blockNodes!.push(node);
    }
    node = node.nextSibling;
  }

  return blockNodes || nodes;
}

coreModule.directive('rebuildOnChange', ['$animate', rebuildOnChange]);

function rebuildOnChange($animate: any) {
  return {
    multiElement: true,
    terminal: true,
    transclude: true,
    priority: 600,
    restrict: 'E',
    link: (scope: any, elem: any, attrs: any, ctrl: any, transclude: any) => {
      let block: any, childScope: any, previousElements: any;

      function cleanUp() {
        if (previousElements) {
          previousElements.remove();
          previousElements = null;
        }
        if (childScope) {
          childScope.$destroy();
          childScope = null;
        }
        if (block) {
          previousElements = getBlockNodes(block.clone);
          $animate.leave(previousElements).then(() => {
            previousElements = null;
          });
          block = null;
        }
      }

      scope.$watch(attrs.property, function rebuildOnChangeAction(value: any, oldValue: any) {
        if (childScope && value !== oldValue) {
          cleanUp();
        }

        if (!childScope && (value || attrs.showNull)) {
          transclude((clone: any, newScope: any) => {
            childScope = newScope;
            clone[clone.length++] = document.createComment(' end rebuild on change ');
            block = { clone: clone };
            $animate.enter(clone, elem.parent(), elem);
          });
        } else {
          cleanUp();
        }
      });
    },
  };
}
