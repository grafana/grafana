///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
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

function rebuildOnChange($compile) {

  return {
    transclude: true,
    priority: 600,
    restrict: 'A',
    link: function(scope, elem, attrs, ctrl, transclude) {
      var childScope, previousElements;
      var uncompiledHtml;

      scope.$watch(attrs.rebuildOnChange, function rebuildOnChangeAction(value) {

        if (childScope) {
          childScope.$destroy();
          childScope = null;
          elem.empty();
        }

        if (value) {
          if (!childScope) {
            transclude(function(clone, newScope) {
              childScope = newScope;
              elem.append($compile(clone)(childScope));
            });
          }
        }

      });
    }
  };
}

coreModule.directive('rebuildOnChange', rebuildOnChange);
