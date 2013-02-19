/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.services', [])
.service('eventBus', function($rootScope) {

  this.broadcast = function(from,to,type,data) {
    if(_.isUndefined(data))
      var data = from

    //console.log('Sent: '+type + ' to ' + to + ' from ' + from + ': ' + angular.toJson(data))
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
      var _group  = (!(_.isUndefined(scope.panel))) ? scope.panel.group : ["NONE"] 

      //console.log('registered:' + type + " for " + scope.panel.title + " " + scope.$id)
      if(!(_.isArray(_to)))
        _to = [_to];
      if(!(_.isArray(_group)))
        _group = [_group];
      
      if((_.intersection(_to,_group).length > 0 || 
        _.indexOf(_to,_id) > -1 ||
        _.indexOf(_to,'ALL') > -1) &&
        _from !== _id
        ) {
        //console.log('Got: '+type + ' from ' + _from + ' to ' + _to + ': ' + angular.toJson(packet.data))
        fn(event,packet.data);
      }
    });
  }

})
.service('timer', function($timeout) {
  // This service really just tracks a list of $timeout promises to give us a
  // method for cancelling them all when we need to

  var timers = [];

  this.register = function(promise) {
    timers.push(promise);
    return promise;
  }

  this.cancel = function(promise) {
    timers = _.without(timers,promise)
    $timeout.cancel(promise)
  }

  this.cancel_all = function() {
    _.each(timers, function(t){
      $timeout.cancel(t);
    });
    timers = new Array();
  }

});
