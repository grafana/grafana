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
* index :: Index pattern to match. Literals should be double quoted. Default: '"logstash-"yyyy.mm.dd'
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

  var _id = _.uniqueId();

  // Set and populate defaults
  var _d = {
    mode          : "relative",
    time_options  : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
    timespan      : '15m',
    index         : '"logstash-"yyyy.mm.dd',
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
          from : Date.parse($scope.panel.time.from),
          to   : Date.parse($scope.panel.time.to)
        }
        break;
      case 'since':
        $scope.time = {
          from : Date.parse($scope.panel.time.from),
          to   : new Date()
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

    // In the case that a panel is not ready to receive a time event, it may
    // request one be sent by broadcasting a 'get_time' with its _id to its group
    // This panel can handle multiple groups
    eventBus.register($scope,"get_time", function(event,id) {
      eventBus.broadcast($scope.$id,id,'time',$scope.time)
    });

    $scope.$watch('panel.refresh.enable', function() {$scope.refresh()});
    $scope.$watch('panel.refresh.interval', function() {
      $timeout(function(){
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
      });
    });
  }

  $scope.refresh = function() {
    if ($scope.panel.refresh.enable) {
      $scope.time_apply();
      timer.cancel($scope.refresh_timer)
      $scope.refresh_timer = timer.register($timeout(
        $scope.refresh,
        $scope.panel.refresh.interval*1000
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

  $scope.time_check = function(){
    var from = $scope.panel.mode === 'relative' ? time_ago($scope.panel.timespan) :
      Date.parse($scope.timepicker.from.date + " " + $scope.timepicker.from.time)
    var to = $scope.panel.mode !== 'absolute' ? new Date() :
      Date.parse($scope.timepicker.to.date + " " + $scope.timepicker.to.time)

    if (from.getTime() >= to.getTime())
      from = new Date(to.getTime() - 1000)

    // Janky 0s timeout to get around $scope queue processing view issue
    $timeout(function(){
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
    indices($scope.time.from,$scope.time.to).then(function (p) {
      $scope.time.index = p.join();
      // Broadcast time
      eventBus.broadcast($scope.$id,$scope.panel.group,'time',$scope.time)
    });

    // Update panel's string representation of the time object
    $scope.panel.time = { 
      from : $scope.time.from.format("mm/dd/yyyy HH:MM:ss"),
      to : $scope.time.to.format("mm/dd/yyyy HH:MM:ss"),
      index : $scope.time.index,
    };
  };

  // returns a promise containing an array of all indices matching the index
  // pattern that exist in a given range
  function indices(from,to) {
    var possible = [];
    _.each(date_range(from,to.add_days(1)),function(d){
      possible.push(d.format($scope.panel.index));
    });

    return all_indices().then(function(p) {
      return _.intersection(p,possible);
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

  // Great, every function is ready, init.
  $scope.init();

})