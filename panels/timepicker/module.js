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
  * refresh: Object containing refresh parameters
    * enable :: true/false, enable auto refresh by default. Default: false
    * interval :: Seconds between auto refresh. Default: 30
    * min :: The lowest interval a user may set
*/

angular.module('kibana.timepicker', [])
.controller('timepicker', function($scope, $rootScope, $timeout, timer, $http, dashboard, filterSrv) {

  // Set and populate defaults
  var _d = {
    status        : "Stable",
    mode          : "relative",
    time_options  : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
    timespan      : '15m',
    timefield     : '@timestamp',
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
    $scope.filterSrv = filterSrv;

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
    // These 3 statements basicly do everything time_apply() does
    set_timepicker($scope.time.from,$scope.time.to)
    update_panel()
    set_time_filter($scope.time)
    dashboard.refresh();


    // Start refresh timer if enabled
    if ($scope.panel.refresh.enable)
      $scope.set_interval($scope.panel.refresh.interval);

    // In case some other panel broadcasts a time, set us to an absolute range
    $scope.$on('refresh', function() {
      if(filterSrv.idsByType('time').length > 0) {
        var time = filterSrv.timeRange('min')

        if($scope.time.from.diff(moment.utc(time.from)) != 0 
          || $scope.time.to.diff(moment.utc(time.to)) != 0)
        {
          $scope.set_mode('absolute');

          // These 3 statements basicly do everything time_apply() does
          set_timepicker(moment(time.from),moment(time.to))
          $scope.time = $scope.time_calc();
          update_panel()
        }
      }
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

  var update_panel = function() {
    // Update panel's string representation of the time object.Don't update if
    // we're in relative mode since we dont want to store the time object in the
    // json for relative periods
    if($scope.panel.mode !== 'relative') {
      $scope.panel.time = { 
        from : $scope.time.from.format("MM/DD/YYYY HH:mm:ss"),
        to : $scope.time.to.format("MM/DD/YYYY HH:mm:ss"),
      };
    } else {
      delete $scope.panel.time;
    }
  }

  $scope.set_mode = function(mode) {
    $scope.panel.mode = mode;
    $scope.panel.refresh.enable = mode === 'absolute' ? 
      false : $scope.panel.refresh.enable

    update_panel();
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

    // Remove all other time filters
    filterSrv.removeByType('time')

    $scope.time = $scope.time_calc();
    $scope.time.field = $scope.panel.timefield
    update_panel()

    set_time_filter($scope.time)
    dashboard.refresh();

  };


  function set_time_filter(time) {
    time.type = 'time'
    // Check if there's a time filter we remember, if not, set one and remember it
    if(!_.isUndefined($scope.panel.filter_id) && 
      !_.isUndefined(filterSrv.list[$scope.panel.filter_id]) && 
      filterSrv.list[$scope.panel.filter_id].type == 'time') 
    {
      filterSrv.set(compile_time(time),$scope.panel.filter_id)
    } else {
      $scope.panel.filter_id = filterSrv.set(compile_time(time))
    }
    return $scope.panel.filter_id;
  }

  // Prefer to pass around Date() objects since interacting with
  // moment objects in libraries that are expecting Date()s can be tricky
  function compile_time(time) {
    time = _.clone(time)
    time.from = time.from.toDate()
    time.to   = time.to.toDate()
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