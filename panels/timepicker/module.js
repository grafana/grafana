/*
## Timepicker

The timepicker panel is used to select time ranges and inform other panel of 
them. It also handles searching for indices that match the given time range and 
a pattern

### Parameters
* mode :: The default mode of the panel. Options: 'relative', 'absolute' 'since' Default: 'relative'
* time_options :: An array of possible time options. Default: ['5m','15m','1h','6h','12h','24h','2d','7d','30d']
* timespan :: The default options selected for the relative view. Default: '15m'
* timefield :: The field in which time is stored in the document.
* index :: Index pattern to match. Literals should be double quoted. Default: '_all'
* defaultindex :: Index to failover to if index not found
* refresh: Object containing refresh parameters
  * enable :: true/false, enable auto refresh by default. Default: false
  * interval :: Seconds between auto refresh. Default: 30
  * min :: The lowest interval a user may set

### Group Events
#### Sends
* time :: Object Includes from, to and index
#### Receives
* get_time :: Receives an object containing a uniqueid, broadcasts to it.

*/
angular.module('kibana.timepicker', [])
.controller('timepicker', function($scope, eventBus, $timeout, timer, $http) {

  // Set and populate defaults
  var _d = {
    mode          : "relative",
    time_options  : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
    timespan      : '15m',
    timefield     : '@timestamp',
    index         : '_all',
    defaultindex  : "_all",
    index_interval: "day",
    group         : "default",
    refresh       : {
      enable  : false, 
      interval: 30,
      min     : 3
    }
  }
  _.defaults($scope.panel,_d)

  var _groups = _.isArray($scope.panel.group) ? 
    $scope.panel.group : [$scope.panel.group];

  $scope.init = function() {
    // Private refresh interval that we can use for view display without causing
    // unnecessary refreshes during changes
    $scope.refresh_interval = $scope.panel.refresh.interval

    // Init a private time object with Date() objects depending on mode
    switch($scope.panel.mode) {
      case 'absolute':
        $scope.time = {
          from : new Date(Date.parse($scope.panel.time.from)) || time_ago($scope.panel.timespan),
          to   : new Date(Date.parse($scope.panel.time.to)) || new Date()
        }
        break;
      case 'since':
        $scope.time = {
          from : new Date(Date.parse($scope.panel.time.from)) || time_ago($scope.panel.timespan),
          to   : new Date() || new Date()
        }
        break;
      case 'relative':
        $scope.time = {
          from : time_ago($scope.panel.timespan),
          to   : new Date()
        }
        break;
    }
    $scope.time.field = $scope.panel.timefield;
    $scope.time_apply();

    // Start refresh timer if enabled
    if ($scope.panel.refresh.enable)
      $scope.set_interval($scope.panel.refresh.interval);

    // In the case that a panel is not ready to receive a time event, it may
    // request one be sent by broadcasting a 'get_time' with its _id to its group
    // This panel can handle multiple groups
    eventBus.register($scope,"get_time", function(event,id) {
      eventBus.broadcast($scope.$id,id,'time',$scope.time)
    });

    // In case some other panel broadcasts a time, set us to an absolute range
    eventBus.register($scope,"set_time", function(event,time) {
      $scope.panel.mode = 'absolute';
      set_timepicker(time.from,time.to)
      $scope.time_apply()
    });
    
    eventBus.register($scope,"zoom", function(event,factor) {
      var _timespan = ($scope.time.to.getTime() - $scope.time.from.getTime());
      try {
        if($scope.panel.mode != 'absolute') {
          $scope.panel.mode = 'since'
          set_timepicker(new Date($scope.time.to.getTime() - _timespan*factor),$scope.time.to)
        } else {
          var _center = $scope.time.to - _timespan/2
          set_timepicker(new Date(_center - (_timespan*factor)/2),
                         new Date(_center + (_timespan*factor)/2))        
        }
      } catch (e) {
        console.log(e)
      }     
      $scope.time_apply();
    });
    
    $scope.$on('render', function (){
      $scope.time_apply();
    });
  }

  $scope.set_interval = function (refresh_interval) {
    $scope.panel.refresh.interval = refresh_interval
    if(_.isNumber($scope.panel.refresh.interval)) {
      if($scope.panel.refresh.interval < $scope.panel.refresh.min) {
        $scope.panel.refresh.interval = $scope.panel.refresh.min        
        timer.cancel($scope.refresh_timer)
        return;
      }
      timer.cancel($scope.refresh_timer)
      $scope.refresh()
    } else {
      timer.cancel($scope.refresh_timer)
    }
  }

  $scope.refresh = function() {
    if ($scope.panel.refresh.enable) {
      timer.cancel($scope.refresh_timer)
      $scope.refresh_timer = timer.register($timeout(function() {
        $scope.refresh();
        $scope.time_apply();
        },$scope.panel.refresh.interval*1000
      ));
    } else {
      timer.cancel($scope.refresh_timer)
    }
  }

  $scope.set_mode = function(mode) {
    $scope.panel.mode = mode;
    $scope.panel.refresh.enable = mode === 'absolute' ? 
      false : $scope.panel.refresh.enable
  }

  $scope.to_now = function() {
    $scope.timepicker.to = {
      time : new Date().format("HH:MM:ss"),
      date : new Date().format("mm/dd/yyyy")
    }
  }

  $scope.set_timespan = function(timespan) {
    $scope.panel.timespan = timespan;
    $scope.timepicker.from = {
      time : time_ago(timespan).format("HH:MM:ss"),
      date : time_ago(timespan).format("mm/dd/yyyy")
    }
    $scope.time_apply();
  }

  $scope.close_modal = function() {
    $scope.$broadcast('render');
  }

  $scope.time_check = function(){

    // If time picker is defined (on initialization)
    if(!(_.isUndefined($scope.timepicker))) {
      var from = $scope.panel.mode === 'relative' ? time_ago($scope.panel.timespan) :
        new Date(Date.parse($scope.timepicker.from.date + " " + $scope.timepicker.from.time))
      var to = $scope.panel.mode !== 'absolute' ? new Date() :
        new Date(Date.parse($scope.timepicker.to.date + " " + $scope.timepicker.to.time))
    // Otherwise 
    } else {
      var from = $scope.panel.mode === 'relative' ? time_ago($scope.panel.timespan) :
        $scope.time.from;
      var to = $scope.panel.mode !== 'absolute' ? new Date() :
        $scope.time.to;
    }

    if (from.getTime() >= to.getTime())
      from = new Date(to.getTime() - 1000)

    $timeout(function(){
      set_timepicker(from,to)
    });

    return {
      from : from,
      to   : to
    };
  }

  $scope.time_apply = function() {      
    // Update internal time object
    $scope.time = $scope.time_check();
    $scope.time.field = $scope.panel.timefield

    // Get indices for the time period, then broadcast time range and index list
    // in a single object. Not sure if I like this.
    if($scope.panel.index_interval !== 'none') {
      indices($scope.time.from,$scope.time.to).then(function (p) {
        $scope.time.index = p;
        eventBus.broadcast($scope.$id,$scope.panel.group,'time',$scope.time)
      });
    } else {
      $scope.time.index = [$scope.panel.index];
      eventBus.broadcast($scope.$id,$scope.panel.group,'time',$scope.time)
    }

    // Update panel's string representation of the time object
    $scope.panel.time = { 
      from : $scope.time.from.format("mm/dd/yyyy HH:MM:ss"),
      to : $scope.time.to.format("mm/dd/yyyy HH:MM:ss"),
      index : $scope.time.index,
    };
  };

  function set_timepicker(from,to) {
    // Janky 0s timeout to get around $scope queue processing view issue
    $scope.timepicker = {
      from : {
        time : from.format("HH:MM:ss"),
        date : from.format("mm/dd/yyyy")
      },
      to : {
        time : to.format("HH:MM:ss"),
        date : to.format("mm/dd/yyyy")
      } 
    }
  }

  // returns a promise containing an array of all indices matching the index
  // pattern that exist in a given range
  function indices(from,to) {
    var possible = [];
    _.each(expand_range(fake_utc(from),fake_utc(to),$scope.panel.index_interval),function(d){
      possible.push(d.format($scope.panel.index));
    });

    return all_indices().then(function(p) {
      var indices = _.intersection(possible,p);
      indices.reverse();
      return indices.length == 0 ? [$scope.panel.defaultindex] : indices;
    })
  };

  // returns a promise containing an array of all indices in an elasticsearch
  // cluster
  function all_indices() {
    var something = $http({
      url: config.elasticsearch + "/_aliases",
      method: "GET"
    }).error(function(data, status, headers, config) {
      $scope.error = status;
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
  function fake_utc(date) {
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  }

  // Create an array of date objects by a given interval
  function expand_range(start, end, interval) {
    if(_.contains(['hour','day','week','month','year'],interval)) {
      var range;
      start = start.clone();
      range = [];
      while (start.isBefore(end)) {
        range.push(start.clone());
        switch (interval) {
        case 'hour':
          start.addHours(1)
          break
        case 'day':
          start.addDays(1)
          break
        case 'week':
          start.addWeeks(1)
          break
        case 'month':
          start.addMonths(1)
          break
        case 'year':
          start.addYears(1)
          break
        }
      }
      range.push(end.clone());
      return range;
    } else {
      return false;
    }
  }

})