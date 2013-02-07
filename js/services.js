/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.services', [])
.service('eventBus', function($rootScope) {

  this.broadcast = function(from,to,type,data) {
    if(_.isUndefined(data))
      var data = from

    $rootScope.$broadcast(type,{
      from: from,
      to: to,
      data: data
    });
  }

  // This sets up an $on listener that checks to see if the event (packet) is
  // addressed to the scope in question and runs the registered function if it
  // is.
  this.register = function(scope,type,fn) {
    scope.$on(type,function(event,packet){
      var _id     = scope.$id;
      var _to     = packet.to;
      var _from   = packet.from;

      if(!(_.isArray(_to)))
        _to = [_to];
      if(!(_.isArray(scope.panel.group)))
        scope.panel.group = [scope.panel.group];
      
      if(_.intersection(_to,scope.panel.group).length > 0 || _.indexOf(_to,_id) > -1) {
        fn(event,packet.data);
      }
    });
  }

});
