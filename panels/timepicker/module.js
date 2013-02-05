angular.module('kibana.timepicker', [])
.controller('timepicker', function($scope, $rootScope, $timeout) {

  // Set and populate defaults
  var _d = {
    mode    : "relative",
    time_options : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
    timespan : '15m',
    refresh : {
      enable: false, 
      interval: 3,
      min: 3
    },
    time    : {
      from  : $scope.time.from,
      to    : $scope.time.to
    }
  }
  _.each(_d, function(v, k) {
    $scope.panel[k] = _.isUndefined($scope.panel[k]) 
      ? _d[k] : $scope.panel[k];
  });

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

  // Init the values for the time/date pickers
  $scope.timepicker = {
    from : {
      time : $scope.time.from.format("HH:MM:ss"),
      date : $scope.time.from.format("mm/dd/yyyy")
    },
    to : {
      time : $scope.time.to.format("HH:MM:ss"),
      date : $scope.time.to.format("mm/dd/yyyy")
    } 
  } 

  // In the case that a panel is not ready to receive a time event, it may
  // request one be sent by broadcasting a 'get_time' even to its group
  if (!(_.isUndefined($scope.panel.group))) {
    // Broadcast time when initializing
    $rootScope.$broadcast($scope.panel.group+"-time", $scope.time)

    // And whenever it is requested
    $scope.$on($scope.panel.group+"-get_time", function(event) {
      $rootScope.$broadcast($scope.panel.group+"-time", $scope.time)
    });
  }
  
  $scope.$watch('panel.refresh.enable', function() {$scope.refresh()});
  $scope.$watch('panel.refresh.interval', function() {
    $timeout(function(){
      if(_.isNumber($scope.panel.refresh.interval)) {
        if($scope.panel.refresh.interval < $scope.panel.refresh.min) {
          $scope.panel.refresh.interval = $scope.panel.refresh.min        
          $timeout.cancel($scope.panel.refresh.timer)
          return;
        }
        $timeout.cancel($scope.panel.refresh.timer)
        $scope.refresh()
      } else {
        $timeout.cancel($scope.panel.refresh.timer)
      }
    });
  });


  $scope.refresh = function() {
    if ($scope.panel.refresh.enable) {
      $scope.time_apply();
      $scope.panel.refresh.timer = $timeout(
        $scope.refresh,
        $scope.panel.refresh.interval*1000
      );
    } else {
      $timeout.cancel($scope.panel.refresh.timer)
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
  }

  $scope.time_apply = function() {  
    $scope.time_check();
    // Update internal time object
    $scope.time = { 
      from : Date.parse($scope.timepicker.from.date + " " + $scope.timepicker.from.time), 
      to : Date.parse($scope.timepicker.to.date + " " + $scope.timepicker.to.time)
    };

    // Broadcast time
    $rootScope.$broadcast($scope.panel.group+"-time", $scope.time)

    // Update panel's string representation of the time object
    $scope.panel.time = { 
      from : $scope.time.from.format("mm/dd/yyyy HH:MM:ss"),
      to : $scope.time.to.format("mm/dd/yyyy HH:MM:ss") 
    };
  };

})