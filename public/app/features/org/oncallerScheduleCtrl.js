define([
  'moment',
  'jquery',
  'angular',
  'lodash',
  'ui.calendar',
  'zh-cn',
],
  function (moment, $, angular, _, uiCalendarConfig) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('OnCallerScheduleCtrl', function ($scope, oncallerMgrSrv) {
      $scope.shadow = {
        color: '#f00',
        textColor: 'yellow',
        events: []
      };
      $scope.primary = {
        color: '#0f0',
        textColor: 'green',
        events: []
      };
      $scope.secondary = {
        color: '#00f',
        textColor: 'red',
        events: []
      };
      $scope.roles = [
        {key:'shadow',val:'见习',},
        {key:'primary',val:'值班',},
        {key:'secondary',val:'候选',}
      ];

      $scope.oncallerDefList = null;
      $scope.role = $scope.roles[1];
      $scope.showEditForm = false;
      $scope.oncallerSelcted = null;
      $scope.init = function() {
        /* config object uiConfig defined after the event */
        $scope.uiConfig = {
          calendar: {
            height: 450,
            editable: true,
            locale: 'zh-cn',
            monthNames: moment.months(),
            monthNamesShort: moment.monthsShort(),
            dayNames: moment.weekdays(),
            dayNamesShort: moment.weekdaysShort(),
            header: {
              left: 'prev,next today',
              center: 'title',
              right: 'month,agendaWeek,agendaDay'
            },
            dayClick: $scope.getEventTime,
            eventClick: $scope.alertOnEventClick,
            viewRender: $scope.viewRender,
          }
        };

        $scope.eventSources = [$scope.shadow,$scope.primary,$scope.secondary];
      };

      var addEvent = function(oncaller, role) {
        oncaller.stick = true;
        oncaller.color = $scope[role].color;
        oncaller.textColor = $scope[role].textColor;
        oncaller.className = [];
        oncaller.className.push(role);
        if(_.findIndex($scope[role].events,{start:oncaller.start}) == (-1 || undefined)){
          $scope[role].events.push(oncaller);
          if(!oncaller.end){
            var len = $scope[role].events.length;
            if(len < 2){
              return;
            } else {
              $scope[role].events[len-2].end = oncaller.start;
            }
          }
        }
      }

      var getTimeSec = function(time) {
        return new Date(time).valueOf()/1000;
      }

      /* alert on eventClick */
      $scope.alertOnEventClick = function(date, jsEvent, view) {
        $scope.showEditForm = true;
        $scope.startTime = date.start;
        $scope.endTime = date.end;
        $scope.role = _.find($scope.roles,{key: date.className[0]});
        oncallerMgrSrv.load().then(function onSuccess(response) {
          $scope.oncallerDefList = response.data;
          $scope.oncallerSelcted = _.find($scope.oncallerDefList, {id: date.id});
        });
      };

      $scope.viewRender = function(view, element) {
        oncallerMgrSrv.loadSchedule(getTimeSec(view.start._d), getTimeSec(view.end._d)).then(function onSuccess(response) {
          _.each(response.data.roleSchedule, function(roleEvents, role) {
            _.each(roleEvents, function(oncaller, start) {
              oncaller.start = new Date(parseInt(start)*1000);
              oncaller.title = oncaller.name;
              addEvent(oncaller, role);
            });
          });
        });
      };

      $scope.getEventTime = function(date) {
        $scope.showEditForm = true;
        $scope.startTime = moment(date._d).format('YYYY-MM-DD HH:mm:ss');
        oncallerMgrSrv.load().then(function onSuccess(response) {
          $scope.oncallerDefList = response.data;
        });
      };

      $scope.absoluteFromChanged = function (start) {
        $scope.startTime = moment(start).format('YYYY-MM-DD HH:mm:ss');
      }

      $scope.absoluteToChanged = function (end) {
        $scope.endTime = moment(end).format('YYYY-MM-DD HH:mm:ss');
      }

      $scope.addSchedule = function(role,oncallerSelcted) {
        var oncaller = {
          title: oncallerSelcted.name,
          start: new Date($scope.startTime),
          end: new Date($scope.endTime),
          id: oncallerSelcted.id,
        }
        addEvent(oncaller, role.key);
        oncallerMgrSrv.updateSchedule(role.key, oncallerSelcted.id, getTimeSec($scope.startTime), getTimeSec($scope.endTime));
        $scope.closeEdit();
      }

      $scope.closeEdit = function() {
        $scope.showEditForm = false;
      }

      $scope.init();
    });
  });
