define([
  'angular',
  'underscore'
],
function (angular, _) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('panelMove', function(dashboard, $rootScope) {

    /* each of these can take event,ui,data parameters */

    this.onStart = function() {
      dashboard.panelDragging =  true;
      $rootScope.$apply();
    };

    this.onOver = function() {
      $rootScope.$apply();
    };

    this.onOut = function() {
      $rootScope.$apply();
    };

    /*
      Use our own drop logic. the $parent.$parent this is ugly.
    */
    this.onDrop = function(event,ui,data) {
      var
        dragRow = data.draggableScope.$parent.$parent.row.panels,
        dropRow =  data.droppableScope.$parent.$parent.row.panels,
        dragIndex = data.dragSettings.index,
        dropIndex =  data.dropSettings.index;


      // Remove panel from source row
      dragRow.splice(dragIndex,1);

      // Add to destination row
      if(!_.isUndefined(dropRow)) {
        dropRow.splice(dropIndex,0,data.dragItem);
      }

      dashboard.panelDragging = false;
      // Cleanup nulls/undefined left behind
      cleanup();
      $rootScope.$apply();
      $rootScope.$broadcast('render');
    };

    this.onStop = function() {
      dashboard.panelDragging = false;
      cleanup();
      $rootScope.$apply();
    };

    var cleanup = function () {
      _.each(dashboard.current.rows, function(row) {
        row.panels = _.without(row.panels,{});
        row.panels = _.compact(row.panels);
      });
    };

  });

});