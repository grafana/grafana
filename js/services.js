/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.services', [])
.service('eventBus', function($rootScope) {

  // An array of registed types
  var _types = []

  this.broadcast = function(from,to,type,data) {
    if(_.isUndefined(data))
      var data = from

    var packet = {
      time: new Date(),
      type: type,
      from: from,
      to: to,
      data: data
    }

    if(_.contains(_types,'$kibana_debug'))
      $rootScope.$broadcast('$kibana_debug',packet);

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

    _types = _.union(_types,[type])

    scope.$on(type,function(event,packet){
      var _id     = scope.$id;
      var _to     = packet.to;
      var _from   = packet.from;
      var _type   = packet.type
      var _time   = packet.time
      var _group  = (!(_.isUndefined(scope.panel))) ? scope.panel.group : ["NONE"] 

      //console.log('registered:' + type + " for " + scope.panel.title + " " + scope.$id)
      if(!(_.isArray(_to)))
        _to = [_to];
      if(!(_.isArray(_group)))
        _group = [_group];
      
      // Transmit even only if the send is not the receiver AND one of the following:
      // 1) Receiver has group in _to 2) Receiver's $id is in _to
      // 3) Event is addressed to ALL 4) Receiver is in ALL group 
      if((_.intersection(_to,_group).length > 0 || 
        _.indexOf(_to,_id) > -1 ||
        _.indexOf(_group,'ALL') > -1 ||
        _.indexOf(_to,'ALL') > -1) &&
        _from !== _id
      ) {
        //console.log('Got: '+type + ' from ' + _from + ' to ' + _to + ': ' + angular.toJson(packet.data))
        fn(event,packet.data,{time:_time,to:_to,from:_from,type:_type});
      }
    });
  }

})
/* Service: fields
   Provides a global list of all seen fields for use in editor panels
*/
.factory('fields', function($rootScope) {
  var fields = {
    list : []
  }

  $rootScope.$on('fields', function(event,f) {
    fields.list = _.union(f.data.all,fields.list)
  })

  return fields;

})
.service('kbnIndex',function($http) {
  // returns a promise containing an array of all indices matching the index
  // pattern that exist in a given range
  this.indices = function(from,to,pattern,interval) {
    var possible = [];
    _.each(expand_range(fake_utc(from),fake_utc(to),interval),function(d){
      possible.push(d.format(pattern));
    });

    return all_indices().then(function(p) {
      var indices = _.intersection(possible,p);
      indices.reverse();
      return indices
    })
  };

  // returns a promise containing an array of all indices in an elasticsearch
  // cluster
  function all_indices() {
    var something = $http({
      url: config.elasticsearch + "/_aliases",
      method: "GET"
    }).error(function(data, status, headers, config) {
      // Handle error condition somehow?
    });

    return something.then(function(p) {
      var indices = [];
      _.each(p.data, function(v,k) {
        indices.push(k)
      });
      return indices;
    });
  }

  // this is stupid, but there is otherwise no good way to ensure that when
  // I extract the date from an object that I'm get the UTC date. Stupid js.
  // I die a little inside every time I call this function.
  // Update: I just read this again. I died a little more inside.
  // Update2: More death.
  function fake_utc(date) {
    date = moment(date).clone().toDate()
    return moment(new Date(date.getTime() + date.getTimezoneOffset() * 60000));
  }

  // Create an array of date objects by a given interval
  function expand_range(start, end, interval) {
    if(_.contains(['hour','day','week','month','year'],interval)) {
      var range;
      start = moment(start).clone();
      range = [];
      while (start.isBefore(end)) {
        range.push(start.clone());
        switch (interval) {
        case 'hour':
          start.add('hours',1)
          break
        case 'day':
          start.add('days',1)
          break
        case 'week':
          start.add('weeks',1)
          break
        case 'month':
          start.add('months',1)
          break
        case 'year':
          start.add('years',1)
          break
        }
      }
      range.push(moment(end).clone());
      return range;
    } else {
      return false;
    }
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

})
.service('keylistener', function($rootScope) {
    var keys = [];
    $(document).keydown(function (e) {
      keys[e.which] = true;
    });

    $(document).keyup(function (e) {
      delete keys[e.which];
    });

    this.keyActive = function(key) {
      return keys[key] == true;
    }
});
