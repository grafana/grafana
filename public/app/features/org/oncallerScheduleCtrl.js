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

  module.controller('OnCallerScheduleCtrl', function ($scope, oncallerMgrSrv, $timeout) {
    /* oncaller/events
      {
        title: name,            << 显示名称
        start: start,           << 这里需要统一下格式 string YYYY-MM-DDTHH:mm:ss
        end: end,               << 同start
        id: id,                 << 人员id,添加修改时使用
        name: name,             << 后端返回时携带的,这里赋值给title,以供显示
        stick: true,            << 保证events停留在view上，为repeat处理服务
        className: [],          << 这里单纯为了记录并获取角色,其他自定义属性也可以
        color/textColor: color, <<  控制展示颜色,可由前端设置,每个人员一个颜色
      }
    */
    var colors = {
      user0:['#89c4f4','#43a1ed'],
      user1:['#ffd990','#ffbf43'],
      user2:['#fd8b8b','#fc4040'],
      user3:['#20ae72','#146d48'],
      user4:['#ffcd4e','#ffb701'],
    };

    $scope.init = function() {
      $scope.showScheduling = false;

      // 从后台获取的shchedule
      $scope.primary = {
        type: '(主)',
        events: []
      };
      $scope.secondary = {
        type: '(次)',
        events: []
      };
      // 从纯前端排班的shchedule
      $scope.primaryReview = {
        type: '(主)',
        events: []
      };
      $scope.secondaryReview = {
        type: '(次)',
        events: []
      };
      $scope.roles = [
        {key:'primary',val:'值班',},
        {key:'secondary',val:'候选',},
        {key:'primaryReview',val:'值班',},
        {key:'secondaryReview',val:'候选',},
      ];

      // 所有值班人员
      $scope.oncallerDefList = null;
      // 当前人员角色
      $scope.role = null;
      // 编辑表单显示
      $scope.showEditForm = false;
      // 当前人员
      $scope.oncallerSelcted = null;
      // 参与排班人员
      $scope.oncallerList = [];
      // 默认排班周期
      $scope.range = 7;
      // 0点-24点时间
      $scope.changeTimeList = [];
      for(var i=0; i<24; i++){
        var t = i<10 ? '0'+i : i;
        $scope.changeTimeList.push({key: i, value: t + ':00:00'});
      };
      // 默认8点换班
      $scope.changeTime = $scope.changeTimeList[8];
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
            left: '',
            center: 'title',
          },
          eventClick: eventClick,
          viewRender: viewRender,
          eventMouseover: eventMouseover,
          eventMouseout: eventMouseout,
        }
      };

      $scope.eventSources = [$scope.primary,$scope.secondary,$scope.primaryReview,$scope.secondaryReview];

      oncallerMgrSrv.load().then(function onSuccess(response) {
        $scope.oncallerDefList = response.data;
        for(var i in $scope.oncallerDefList){
          var user = 'user'+(i % Object.keys(colors).length);
          $scope.oncallerDefList[i].user = user;
          $scope.oncallerDefList[i].color = colors[user][0];
        }
      });
    };

    function addEvent(oncaller, role) {
      oncaller.textColor = '#fff';
      $scope[role].events.push(oncaller);
      var len = $scope[role].events.length;
      if(len > 1){
        $scope[role].events[len-2].end = oncaller.start;
      }
    }

    function getTimeSec(time) {
      return new Date(time).valueOf()/1000;
    }

    function formatTime(time) {
      if(time){
        return moment(time).format('YYYY-MM-DDTHH:mm:ss');
      } else {
        return '';
      }
    }

    function eventClick(date, jsEvent, view) {
      var today = new Date();
      if(date.end.valueOf() < today.valueOf()) {
        $scope.appEvent('alert-warning', ['抱歉','不可以修改历史数据']);
        return;
      };
      $scope.showEditForm = true;
      $scope.overwrite = true;
      $scope.startTime = formatTime(date.start);
      $scope.endTime = formatTime(date.end);
      $scope.role = _.find($scope.roles,{key: date.className[0]});
      $scope.oncallerSelcted = _.find($scope.oncallerDefList, {id: date.id});
    };

    function viewRender(view, element) {
      $scope.clearReview();
      var today = new Date();
      $scope.zonesStart = new Date(view.intervalStart);
      $scope.zonesEnd = new Date(view.intervalEnd);
      if(today.getTime() > $scope.zonesEnd.getTime()) {
        $scope.zonesStart = today;
        $scope.zonesEnd = today;
      } else if(today.getTime() > $scope.zonesStart.getTime()) {
        $scope.zonesStart = today;
      }
      $scope.zonesStart = moment($scope.zonesStart).format('YYYY-MM-DD');
      $scope.zonesEnd = moment($scope.zonesEnd).format('YYYY-MM-DD');

      $scope.curInterval = {start: view.start._d, end: view.end._d};

      loadSchedule(view.start._d, view.end._d)
    };

    function loadSchedule(start, end) {
      oncallerMgrSrv.loadSchedule(getTimeSec(start), getTimeSec(end)).then(function onSuccess(response) {
        _.each(response.data.roleSchedule, function(roleEvents, role) {
          _.each(roleEvents, function(oncaller, start) {
            oncaller.start = formatTime(new Date(parseInt(start)*1000));
            oncaller.title = oncaller.name+$scope[role].type;
            oncaller.color = colors[_.find($scope.oncallerDefList, {id: oncaller.id}).user][0];
            oncaller.className = [];
            oncaller.className.push(role);
            oncaller.end = formatTime(end);
            addEvent(oncaller, role);
          });
        });
      });
    }

    function eventMouseover(event, jsEvent, view) {
      this.style.backgroundColor = '#eee';
    };

    function eventMouseout(event, jsEvent, view) {
      this.style.backgroundColor = event.color;
    };

    $scope.updateSchedule = function(oncallerSelcted, start, end) {
      var role = $scope.role.key;
      oncallerSelcted.title = oncallerSelcted.name + $scope[role].type;
      oncallerSelcted.end = end;
      oncallerSelcted.start = start;
      if(role == 'primary' || role == 'secondary') {
        updateSchedule($scope.role.key, oncallerSelcted);
        var index = _.findIndex($scope[role].events, {start: start});
        if(index == -1){
          $scope.clearReview();
          $timeout(function() {
            loadSchedule($scope.curInterval.start, $scope.curInterval.end);
          });
        } else {
          $scope[role].events[index].title = oncallerSelcted.title;
          $scope[role].events[index].color = colors[_.find($scope.oncallerDefList, {id: oncallerSelcted.id}).user][0];
        }
      };
      $scope.closeEdit();
    }

    $scope.closeEdit = function() {
      $scope.showEditForm = false;
      $scope.overwrite = false;
      $scope.addoncaller = false;
    }

    $scope.showOncallers = function() {
      if($scope.oncallerList.length == $scope.oncallerDefList.length) {
        $scope.appEvent('alert-warning', ['您已添加所有值班人员']);
      } else {
        $scope.showEditForm = true;
        $scope.addoncaller = true;
      }
    };

    $scope.addOncallers = function() {
      var index = _.findIndex($scope.oncallerList,$scope.oncallerSelcted);
      if(index == -1){
        $scope.oncallerList.push($scope.oncallerSelcted);
        $scope.closeEdit();
        $scope.reviewSchedule();
      } else {
        $scope.appEvent('alert-warning', ['您已添加该值班人员','请重新选择']);
      }
    };

    $scope.chooseOncallers = function(oncaller) {
      $scope.oncallerSelcted = oncaller;
    }

    $scope.deleteOncaller = function(oncallerSelcted) {
      _.pull($scope.oncallerList,oncallerSelcted);
      $scope.reviewSchedule();
    };

    $scope.clearReview = function() {
      while($scope.primary.events.length){
        $scope.primary.events.pop();
        $scope.secondary.events.pop();
      }
      while($scope.primaryReview.events.length){
        $scope.primaryReview.events.pop();
        $scope.secondaryReview.events.pop();
      }
    }

    $scope.reviewSchedule = function(time, range) {
      $scope.changeTime = time || $scope.changeTime;
      $scope.range = range || $scope.range;
      $scope.clearReview();
      var oncallerLength = $scope.oncallerList.length;
      if(oncallerLength) {
        var zonesStart = new Date($scope.zonesStart);
        zonesStart.setHours($scope.changeTime.key);
        var zonesEnd = new Date($scope.zonesEnd);
        zonesEnd.setHours($scope.changeTime.key);
        var num = (zonesEnd.getTime() - zonesStart.getTime())/(1000*60*60*24)/$scope.range;
        for(var i=0; i<num; i++) {
          var start = new Date(zonesStart).setDate(zonesStart.getDate()+i*$scope.range);
          var end = new Date(zonesStart).setDate(zonesStart.getDate()+(i+1)*$scope.range);
          var pri = $scope.oncallerList[i % oncallerLength];
          var oncallerPri = {
            title: pri.name+$scope.primaryReview.type,
            className: ['primaryReview'],
            start: formatTime(start),
            end: formatTime(end),
            id: pri.id,
            color: pri.color,
          };
          addEvent(oncallerPri, 'primaryReview');
          var sec = $scope.oncallerList[(i+1) % oncallerLength];
          var oncallerSec = {
            title: sec.name+$scope.secondaryReview.type,
            className: ['primaryReview'],
            start: formatTime(start+1000),
            end: formatTime(end),
            id: sec.id,
            color: sec.color,
          }
          addEvent(oncallerSec, 'secondaryReview');
        }
      };
    };

    $scope.saveSchedule = function() {
      while($scope.primaryReview.events.length) {
        var primaryReview = $scope.primaryReview.events.shift();
        var secondaryReview = $scope.secondaryReview.events.shift();
        updateSchedule('primary', primaryReview);
        updateSchedule('secondary', secondaryReview);
        addEvent(primaryReview, 'primary');
        addEvent(secondaryReview, 'secondary');
      };
      $scope.showScheduling = false;
    };

    function updateSchedule(role,oncallerSelcted) {
      oncallerMgrSrv.updateSchedule(role, oncallerSelcted.id, getTimeSec(oncallerSelcted.start), getTimeSec(oncallerSelcted.end)).then(function(response) {
        $scope.appEvent('alert-success', ['保存成功']);
      });
    }

    $scope.init();
  });
});
