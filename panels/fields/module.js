/*jshint globalstrict:true */
/*global angular:true */

/*

  ## Fields (DEPRECATED)

*/

'use strict';

angular.module('kibana.fields', [])
.controller('fields', function($scope, $timeout, dashboard, filterSrv) {

  $scope.panelMeta = {
    status  : "Deprecated",
    description : "You should not use this table, it does not work anymore. The table panel now"+
      "integrates a field selector. This module will soon be removed."
  };


  // Set and populate defaults
  var _d = {
    style   : {},
    arrange : 'vertical',
    micropanel_position : 'right',
  };
  _.defaults($scope.panel,_d);

  $scope.init = function() {
    // Place holder until I remove this
  };

});