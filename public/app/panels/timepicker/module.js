/*

  ## Timepicker2

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
define([
  'angular',
  'app',
  'lodash',
  'moment',
  'kbn'
],
function (angular, app, _, moment, kbn) {
  'use strict';

  var module = angular.module('grafana.panels.timepicker', []);
  app.useModule(module);

  module.controller('timepicker', function($scope, $rootScope, timeSrv) {

    $scope.panelMeta = {
      status  : "Stable",
      description : ""
    };

    // Set and populate defaults
    var _d = {
      status        : "Stable",
      time_options  : ['5m','15m','1h','6h','12h','24h','2d','7d','30d'],
      refresh_intervals : ['5s','10s','30s','1m','5m','15m','30m','1h','2h','1d'],
    };

    _.defaults($scope.panel,_d);

    // ng-pattern regexs
    $scope.patterns = {
      date: /^[0-9]{2}\/[0-9]{2}\/[0-9]{4}$/,
      hour: /^([01]?[0-9]|2[0-3])$/,
      minute: /^[0-5][0-9]$/,
      second: /^[0-5][0-9]$/,
      millisecond: /^[0-9]*$/
    };

    $scope.timeSrv = timeSrv;

    $scope.$on('refresh', function() {
      $scope.init();
    });

    $scope.init = function() {
      var time = timeSrv.timeRange(true);
      $scope.panel.now = false;

      var unparsed = timeSrv.timeRange(false);
      if (_.isString(unparsed.to) && unparsed.to.indexOf('now') === 0) {
        $scope.panel.now = true;
      }

      $scope.time = getScopeTimeObj(time.from, time.to);

      $scope.onAppEvent('zoom-out', function() {
        $scope.zoom(2);
      });
    };

    $scope.loadTimeOptions = function() {
      $scope.time_options = _.map($scope.panel.time_options, function(str) {
        var option = {value: str};
        if (str === 'today') {
          option.text = 'Today';
          option.from = 'today';
          option.to = 'now';
        } else {
          option.text = 'Last ' + str;
          option.from = 'now-'+str;
          option.to = 'now';
        }
        return option;
      });

      $scope.refreshMenuLeftSide = $scope.time.rangeString.length < 10;
    };

    $scope.customTime = function() {
      // Assume the form is valid since we're setting it to something valid
      $scope.input.$setValidity("dummy", true);
      $scope.temptime = cloneTime($scope.time);
      $scope.temptime.now = $scope.panel.now;

      $scope.temptime.from.date.setHours(0,0,0,0);
      $scope.temptime.to.date.setHours(0,0,0,0);

      // Date picker needs the date to be at the start of the day
      if(new Date().getTimezoneOffset() < 0) {
        $scope.temptime.from.date = moment($scope.temptime.from.date).add(1, 'days').toDate();
        $scope.temptime.to.date = moment($scope.temptime.to.date).add(1, 'days').toDate();
      }

      $scope.appEvent('show-dash-editor', {src: 'app/panels/timepicker/custom.html', scope: $scope });
    };

    // Constantly validate the input of the fields. This function does not change any date variables
    // outside of its own scope
    $scope.validate = function(time) {
      // Assume the form is valid. There is a hidden dummy input for invalidating it programatically.
      $scope.input.$setValidity("dummy", true);

      var _from = datepickerToLocal(time.from.date),
        _to = datepickerToLocal(time.to.date),
        _t = time;

      if($scope.input.$valid) {

        _from.setHours(_t.from.hour,_t.from.minute,_t.from.second,_t.from.millisecond);
        _to.setHours(_t.to.hour,_t.to.minute,_t.to.second,_t.to.millisecond);

        // Check that the objects are valid and to is after from
        if(isNaN(_from.getTime()) || isNaN(_to.getTime()) || _from.getTime() >= _to.getTime()) {
          $scope.input.$setValidity("dummy", false);
          return false;
        }
      } else {
        return false;
      }

      return { from: _from, to:_to, now: time.now};
    };

    $scope.setNow = function() {
      $scope.time.to = getTimeObj(new Date());
    };

    /*
      time : {
        from: Date
        to: Date
      }
    */
    $scope.setAbsoluteTimeFilter = function (time) {
      // Create filter object
      var _filter = _.clone(time);

      if(time.now) {
        _filter.to = "now";
      }

      // Update our representation
      $scope.time = getScopeTimeObj(time.from,time.to);
    };

    $scope.setRelativeFilter = function(timespan) {
      $scope.panel.now = true;

      var range = {from: timespan.from, to: timespan.to};

      if ($scope.panel.nowDelay) {
        range.to = 'now-' + $scope.panel.nowDelay;
      }

      timeSrv.setTime(range);

      $scope.time = getScopeTimeObj(kbn.parseDate(range.from),new Date());
    };

    var pad = function(n, width, z) {
      z = z || '0';
      n = n.toString();
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    };

    var cloneTime = function(time) {
      var _n = {
        from: _.clone(time.from),
        to: _.clone(time.to)
      };
      // Create new dates as _.clone is shallow.
      _n.from.date = new Date(_n.from.date);
      _n.to.date = new Date(_n.to.date);
      return _n;
    };

    var getScopeTimeObj = function(from,to) {
      var model = {from: getTimeObj(from), to: getTimeObj(to)};

      if (model.from.date) {
        model.tooltip = $scope.dashboard.formatDate(model.from.date) + ' <br>to<br>';
        model.tooltip += $scope.dashboard.formatDate(model.to.date);
      }
      else {
        model.tooltip = 'Click to set time filter';
      }

      if (timeSrv.time) {
        if ($scope.panel.now) {
          if (timeSrv.time.from === 'today') {
            model.rangeString = 'Today';
          } else {
            model.rangeString = moment(model.from.date).fromNow() + ' to ' +
              moment(model.to.date).fromNow();
          }
        }
        else {
          model.rangeString = $scope.dashboard.formatDate(model.from.date, 'MMM D, YYYY HH:mm:ss') + ' to ' +
            $scope.dashboard.formatDate(model.to.date, 'MMM D, YYYY HH:mm:ss');
        }
      }

      return model;
    };

    var getTimeObj = function(date) {
      return {
        date: new Date(date),
        hour: pad(date.getHours(),2),
        minute: pad(date.getMinutes(),2),
        second: pad(date.getSeconds(),2),
        millisecond: pad(date.getMilliseconds(),3)
      };
    };

    // Do not use the results of this function unless you plan to use setHour/Minutes/etc on the result
    var datepickerToLocal = function(date) {
      date = moment(date).clone().toDate();
      return moment(new Date(date.getTime() + date.getTimezoneOffset() * 60000)).toDate();
    };

    $scope.zoom = function(factor) {
      var range = timeSrv.timeRange();

      var timespan = (range.to.valueOf() - range.from.valueOf());
      var center = range.to.valueOf() - timespan/2;

      var to = (center + (timespan*factor)/2);
      var from = (center - (timespan*factor)/2);

      if(to > Date.now() && range.to <= Date.now()) {
        var offset = to - Date.now();
        from = from - offset;
        to = Date.now();
      }

      timeSrv.setTime({
        from: moment.utc(from).toDate(),
        to: moment.utc(to).toDate(),
      });
    };

  });
});
