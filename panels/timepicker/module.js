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
  * index_interval :: Time between timestamped indices (can be 'none') for static index
  * refresh: Object containing refresh parameters
    * enable :: true/false, enable auto refresh by default. Default: false
    * interval :: Seconds between auto refresh. Default: 30
    * min :: The lowest interval a user may set

  ### Group Events
  #### Sends
  * time :: Object Includes from, to and index
  #### Receives
  * get_time :: Receives an object containing a $id, broadcasts back to it.

*/

angular.module('kibana.timepicker', [])
.controller('timepicker', function($scope, eventBus, $timeout, timer, $http, kbnIndex) {

  // Set and populate defaults
  var _d = {
    status        : "Stable",
    mode          : "relative",
    time_options  : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
    timespan      : '15m',
    timefield     : '@timestamp',
    index         : '_all',
    defaultindex  : "_all",
    index_interval: "none",
    timeformat    : "",
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
          from : moment($scope.panel.time.from,'MM/DD/YYYY HH:mm:ss') || moment(time_ago($scope.panel.timespan)),
          to   : moment($scope.panel.time.to,'MM/DD/YYYY HH:mm:ss') || moment()
        }
        break;
      case 'since':
        $scope.time = {
          from : moment($scope.panel.time.from,'MM/DD/YYYY HH:mm:ss') || moment(time_ago($scope.panel.timespan)),
          to   : moment()
        }
        break;
      case 'relative':
        $scope.time = {
          from : moment(time_ago($scope.panel.timespan)),
          to   : moment()
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
      eventBus.broadcast($scope.$id,id,'time',compile_time($scope.time))
    });

    // In case some other panel broadcasts a time, set us to an absolute range
    eventBus.register($scope,"set_time", function(event,time) {
      $scope.panel.mode = 'absolute';
      set_timepicker(moment(time.from),moment(time.to))
      $scope.time_apply()
    });
    
    eventBus.register($scope,"zoom", function(event,factor) {
      var _timespan = ($scope.time.to.valueOf() - $scope.time.from.valueOf());
      try {
        if($scope.panel.mode != 'absolute') {
          $scope.panel.mode = 'since'
          set_timepicker(moment($scope.time.to.valueOf() - _timespan*factor),$scope.time.to)
        } else {
          var _center = $scope.time.to.valueOf() - _timespan/2
          set_timepicker(moment(_center - (_timespan*factor)/2),
                         moment(_center + (_timespan*factor)/2))        
        }
      } catch (e) {
        console.log(e)
      }     
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
      time : moment().format("HH:mm:ss"),
      date : moment().format("MM/DD/YYYY")
    }
  }

  $scope.set_timespan = function(timespan) {
    $scope.panel.timespan = timespan;
    $scope.timepicker.from = {
      time : moment(time_ago(timespan)).format("HH:mm:ss"),
      date : moment(time_ago(timespan)).format("MM/DD/YYYY")
    }
    $scope.time_apply();
  }

  $scope.close_edit = function() {
    $scope.time_apply();
  }

  // 
  $scope.time_calc = function(){
    // If time picker is defined (usually is)
    if(!(_.isUndefined($scope.timepicker))) {
      var from = $scope.panel.mode === 'relative' ? moment(time_ago($scope.panel.timespan)) :
        moment($scope.timepicker.from.date + " " + $scope.timepicker.from.time,'MM/DD/YYYY HH:mm:ss')
      var to = $scope.panel.mode !== 'absolute' ? moment() :
        moment($scope.timepicker.to.date + " " + $scope.timepicker.to.time,'MM/DD/YYYY HH:mm:ss')
    // Otherwise (probably initialization)
    } else {
      var from = $scope.panel.mode === 'relative' ? moment(time_ago($scope.panel.timespan)) :
        $scope.time.from;
      var to = $scope.panel.mode !== 'absolute' ? moment() :
        $scope.time.to;
    }

    if (from.valueOf() >= to.valueOf())
      from = moment(to.valueOf() - 1000)

    $timeout(function(){
      set_timepicker(from,to)
    });

    return {
      from : from,
      to   : to
    };
  }

  $scope.time_apply = function() {   
    $scope.panel.error = "";   
    // Update internal time object
    $scope.time = $scope.time_calc();
    $scope.time.field = $scope.panel.timefield

    // Get indices for the time period, then broadcast time range and index list
    // in a single object. Not sure if I like this.
    if($scope.panel.index_interval !== 'none') {
      kbnIndex.indices($scope.time.from,
        $scope.time.to,
        $scope.panel.index,
        $scope.panel.index_interval
      ).then(function (p) {
        if(p.length > 0) {
          $scope.time.index = p;
          eventBus.broadcast($scope.$id,$scope.panel.group,'time',compile_time($scope.time))
        } else {
          $scope.panel.error = "Could not match index pattern to any ElasticSearch indices"
        }
      });
    } else {
      $scope.time.index = [$scope.panel.index];
      eventBus.broadcast($scope.$id,$scope.panel.group,'time',compile_time($scope.time))
    }

    // Update panel's string representation of the time object.Don't update if
    // we're in relative mode since we dont want to store the time object in the
    // json for relative periods
    if($scope.panel.mode !== 'relative') {
      $scope.panel.time = { 
        from : $scope.time.from.format("MM/DD/YYYY HH:mm:ss"),
        to : $scope.time.to.format("MM/DD/YYYY HH:mm:ss"),
        index : $scope.time.index,
      };
    } else {
      delete $scope.panel.time;
    }
  };

  // Prefer to pass around Date() objects in the EventBus since interacting with
  // moment objects in libraries that are expecting Date()s can be tricky
  function compile_time(time) {
    time = _.clone(time)
    time.from = time.from.toDate()
    time.to   = time.to.toDate()
    time.interval = $scope.panel.index_interval
    time.pattern = $scope.panel.index 
    return time;
  }

  function set_timepicker(from,to) {
    // Janky 0s timeout to get around $scope queue processing view issue
    $scope.timepicker = {
      from : {
        time : from.format("HH:mm:ss"),
        date : from.format("MM/DD/YYYY")
      },
      to : {
        time : to.format("HH:mm:ss"),
        date : to.format("MM/DD/YYYY")
      } 
    }
  }

})