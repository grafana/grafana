
/** Created by: Alex Wendland (me@alexwendland.com), 2014-08-06
 *
 *  angular-json-tree
 *
 *  Directive for creating a tree-view out of a JS Object. Only loads
 *  sub-nodes on demand in order to improve performance of rendering large
 *  objects.
 *
 *  Attributes:
 *      - object (Object, 2-way): JS object to build the tree from
 *      - start-expanded (Boolean, 1-way, ?=true): should the tree default to expanded
 *
 *  Usage:
 *      // In the controller
 *      scope.someObject = {
 *          test: 'hello',
 *          array: [1,1,2,3,5,8]
 *      };
 *      // In the html
 *      <json-tree object="someObject"></json-tree>
 *
 *  Dependencies:
 *      - utils (json-tree.js)
 *      - ajsRecursiveDirectiveHelper (json-tree.js)
 *
 *  Test: json-tree-test.js
 */

import angular from 'angular';
import coreModule from 'app/core/core_module';

var utils = {
    /* See link for possible type values to check against.
     * http://stackoverflow.com/questions/4622952/json-object-containing-array
     *
     * Value               Class      Type
     * -------------------------------------
     * "foo"               String     string
     * new String("foo")   String     object
     * 1.2                 Number     number
     * new Number(1.2)     Number     object
     * true                Boolean    boolean
     * new Boolean(true)   Boolean    object
     * new Date()          Date       object
     * new Error()         Error      object
     * [1,2,3]             Array      object
     * new Array(1, 2, 3)  Array      object
     * new Function("")    Function   function
     * /abc/g              RegExp     object (function in Nitro/V8)
     * new RegExp("meow")  RegExp     object (function in Nitro/V8)
     * {}                  Object     object
     * new Object()        Object     object
     */
    is: function is(obj, clazz) {
        return Object.prototype.toString.call(obj).slice(8, -1) === clazz;
    },

    // See above for possible values
    whatClass: function whatClass(obj) {
        return Object.prototype.toString.call(obj).slice(8, -1);
    },

    // Iterate over an objects keyset
    forKeys: function forKeys(obj, f) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key) && typeof obj[key] !== 'function') {
                if (f(key, obj[key])) {
                    break;
                }
            }
        }
    }
};

coreModule.directive('jsonTree', [function jsonTreeDirective() {
  return {
    restrict: 'E',
    scope: {
      object: '=',
      startExpanded: '@',
      rootName: '@',
    },
    template: '<json-node key="rootName" value="object" start-expanded="startExpanded"></json-node>'
  };
}]);

coreModule.directive('jsonNode', ['ajsRecursiveDirectiveHelper', function jsonNodeDirective(ajsRecursiveDirectiveHelper) {
  return {
    restrict: 'E',
    scope: {
      key: '=',
      value: '=',
      startExpanded: '@'
    },
    compile: function jsonNodeDirectiveCompile(elem) {
      return ajsRecursiveDirectiveHelper.compile(elem, this);
    },
    template: ' <span class="json-tree-key" ng-click="toggleExpanded()">{{key}}</span>' +
      '       <span class="json-tree-leaf-value" ng-if="!isExpandable">{{value}}</span>' +
      '       <span class="json-tree-branch-preview" ng-if="isExpandable" ng-show="!isExpanded" ng-click="toggleExpanded()">' +
      '            {{preview}}</span>' +
      '       <ul class="json-tree-branch-value" ng-if="isExpandable && shouldRender" ng-show="isExpanded">' +
      '           <li ng-repeat="(subkey,subval) in value">' +
      '               <json-node key="subkey" value="subval"></json-node>' +
      '           </li>' +
      '       </ul>',
    pre: function jsonNodeDirectiveLink(scope, elem, attrs) {
      // Set value's type as Class for CSS styling
      elem.addClass(utils.whatClass(scope.value).toLowerCase());
      // If the value is an Array or Object, use expandable view type
      if (utils.is(scope.value, 'Object') || utils.is(scope.value, 'Array')) {
        scope.isExpandable = true;
        // Add expandable class for CSS usage
        elem.addClass('expandable');
        // Setup preview text
        var isArray = utils.is(scope.value, 'Array');
        scope.preview = isArray ? '[ ' : '{ ';
        utils.forKeys(scope.value, function jsonNodeDirectiveLinkForKeys(key, value) {
          if (value === null) { scope.value[key] = 'null'; }
          if (isArray) {
            scope.preview += value + ', ';
          } else {
            scope.preview += key + ': ' + value + ', ';
          }
        });
        scope.preview = scope.preview.substring(0, scope.preview.length - (scope.preview.length > 2 ? 2 : 0)) + (isArray ? ' ]' : ' }');
        // If directive initially has isExpanded set, also set shouldRender to true
        if (scope.startExpanded) {
          scope.shouldRender = true;
          elem.addClass('expanded');
        }
        // Setup isExpanded state handling
        scope.isExpanded = scope.startExpanded;
        scope.toggleExpanded = function jsonNodeDirectiveToggleExpanded() {
          scope.isExpanded = !scope.isExpanded;
          if (scope.isExpanded) {
            elem.addClass('expanded');
          } else {
            elem.removeClass('expanded');
          }
          // For delaying subnode render until requested
          scope.shouldRender = true;
        };
      } else {
        scope.isExpandable = false;
        // Add expandable class for CSS usage
        elem.addClass('not-expandable');
      }
    }
  };
}]);

/** Added by: Alex Wendland (me@alexwendland.com), 2014-08-09
 *  Source: http://stackoverflow.com/questions/14430655/recursion-in-angular-directives
 *
 *  Used to allow for recursion within directives
 */
coreModule.factory('ajsRecursiveDirectiveHelper', ['$compile', function RecursiveDirectiveHelper($compile) {
  return {
    /**
     * Manually compiles the element, fixing the recursion loop.
     * @param element
     * @param [link] A post-link function, or an object with function(s) registered via pre and post properties.
     * @returns An object containing the linking functions.
     */
    compile: function RecursiveDirectiveHelperCompile(element, link) {
      // Normalize the link parameter
      if (angular.isFunction(link)) {
        link = {
          post: link
        };
      }

      // Break the recursion loop by removing the contents
      var contents = element.contents().remove();
      var compiledContents;
      return {
        pre: (link && link.pre) ? link.pre : null,
        /**
         * Compiles and re-adds the contents
         */
        post: function RecursiveDirectiveHelperCompilePost(scope, element) {
          // Compile the contents
          if (!compiledContents) {
            compiledContents = $compile(contents);
          }
          // Re-add the compiled contents to the element
          compiledContents(scope, function (clone) {
            element.append(clone);
          });

          // Call the post-linking function, if any
          if (link && link.post) {
            link.post.apply(null, arguments);
          }
        }
      };
    }
  };
}]);
