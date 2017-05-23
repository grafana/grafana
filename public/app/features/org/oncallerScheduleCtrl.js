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
      /* oncaller/events
        {
          title: name,       << 显示名称
          start: start,
          end: end,
          id: id,             << 人员id,添加修改时使用
          name: name,         << 后端返回时携带的,这里赋值给title,以供显示
          stick: true,        << 保证events停留在view上，为repeat处理服务
          className: [],      << 这里单纯为了记录角色,其他自定义属性也可以
          color/textColor: color, <<  控制展示颜色,可由前端设置
        }
      */
      $scope.shadow = {
        color: '#f00',
        textColor: 'black',
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
              right: 'month,basicWeek,basicDay'
            },
            dayClick: dayClick,
            eventClick: eventClick,
            viewRender: viewRender,
            eventMouseover: eventMouseover,
            eventMouseout: eventMouseout,
          }
        };

        $scope.eventSources = [$scope.shadow,$scope.primary,$scope.secondary];
      };

      function addEvent(oncaller, role) {
        oncaller.stick = true;
        oncaller.color = $scope[role].color;
        oncaller.textColor = $scope[role].textColor;
        oncaller.className = [];
        oncaller.className.push(role);
        var index = _.findIndex($scope[role].events,{start:oncaller.start});
        if(index == (-1 || undefined)){
          $scope[role].events.push(oncaller);
          if(!oncaller.end){
            var len = $scope[role].events.length;
            if(len < 2){
              return;
            } else {
              $scope[role].events[len-2].end = oncaller.start;
            }
          }
        } else {
          $scope[role].events[index].title = oncaller.title;
        }
      }

      function getTimeSec(time) {
        return new Date(time).valueOf()/1000;
      }

      function formatTime(time) {
        if(time){
          return moment(time).format('YYYY-MM-DD HH:mm:ss');
        } else {
          return '';
        }
      }

      function eventClick(date, jsEvent, view) {
        $scope.showEditForm = true;
        $scope.startTime = formatTime(date.start);
        $scope.endTime = formatTime(date.end);
        $scope.role = _.find($scope.roles,{key: date.className[0]});
        oncallerMgrSrv.load().then(function onSuccess(response) {
          $scope.oncallerDefList = response.data;
          $scope.oncallerSelcted = _.find($scope.oncallerDefList, {id: date.id});
        });
      };

      function viewRender(view, element) {
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

      function dayClick(date) {
        $scope.showEditForm = true;
        $scope.startTime = formatTime(date._d);
        oncallerMgrSrv.load().then(function onSuccess(response) {
          $scope.oncallerDefList = response.data;
        });
      };

      function eventMouseover(event, jsEvent, view) {
        this.style.backgroundColor = '#eee';
      };

      function eventMouseout(event, jsEvent, view) {
        this.style.backgroundColor = $scope[event.className[0]].color;
      };

      $scope.absoluteFromChanged = function (start) {
        $scope.startTime = formatTime(start);
      }

      $scope.absoluteToChanged = function (end) {
        $scope.endTime = formatTime(end);
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
