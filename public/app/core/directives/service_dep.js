define([
    'jquery',
    'lodash',
    '../core_module'
  ],
  function ($, _, coreModule) {
    'use strict';

    coreModule.directive('node', function(jsPlumbFactory) {
      return jsPlumbFactory.node({
        templateUrl: "node_template.tpl",
        inherit:["remove"]
      });
    });

    coreModule.directive('group', function(jsPlumbFactory) {
      return jsPlumbFactory.group({
        templateUrl: "group_template.tpl",
        inherit:["remove", "toggleGroup"]
      });
    });
  }
);