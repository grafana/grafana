import $ from 'jquery';
import coreModule from '../core_module';

function getBlockNodes(nodes) {
  var node = nodes[0];
  var endNode = nodes[nodes.length - 1];
  var blockNodes;

  for (var i = 1; node !== endNode && (node = node.nextSibling); i++) {
    if (blockNodes || nodes[i] !== node) {
      if (!blockNodes) {
        blockNodes = $([].slice.call(nodes, 0, i));
      }
      blockNodes.push(node);
    }
  }

  return blockNodes || nodes;
}

/** @ngInject **/
function rebuildOnChange($animate) {
  return {
    multiElement: true,
    terminal: true,
    transclude: true,
    priority: 600,
    restrict: 'E',
    link: function(scope, elem, attrs, ctrl, transclude) {
      var block, childScope, previousElements;

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
          $animate.leave(previousElements).then(function() {
            previousElements = null;
          });
          block = null;
        }
      }

      scope.$watch(attrs.property, function rebuildOnChangeAction(value, oldValue) {
        if (childScope && value !== oldValue) {
          cleanUp();
        }

        if (!childScope && (value || attrs.showNull)) {
          transclude(function(clone, newScope) {
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

coreModule.directive('rebuildOnChange', rebuildOnChange);
