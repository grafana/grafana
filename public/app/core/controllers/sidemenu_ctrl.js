define([
  'angular',
  'lodash',
  'jquery',
  '../core_module',
  'app/core/config',
],
function (angular, _, $, coreModule, config) {
  'use strict';

  coreModule.controller('SideMenuCtrl', function($scope, $location, contextSrv, backendSrv) {

    $scope.getUrl = function(url) {
      return config.appSubUrl + url;
    };

    $scope.setupMainNav = function() {
      $scope.mainLinks.push({
        text: "系统总览",
        icon: "fa fa-fw fa-home",
        href: $scope.getUrl("/"),
      });

      $scope.mainLinks.push({
        text: "智能仪表盘",
        icon: "fa fa-fw fa-th-large",
        href: $scope.getUrl("/dashboardlist"),
      });

      $scope.mainLinks.push({
        text: "系统状况",
        icon: "fa fa-fw fa-cubes",
        href: $scope.getUrl("/service"),
      });

      $scope.mainLinks.push({
        text: "探针状态",
        icon: "fa fa-fw fa-crosshairs",
        href: $scope.getUrl("/summary"),
      });

      $scope.mainLinks.push({
        text: "健康报告",
        icon: "fa fa-fw fa-list-alt",
        href: $scope.getUrl("/report"),
      });

      if (contextSrv.isGrafanaAdmin) {
        $scope.mainLinks.push({
          text: "申请用户",
          icon: "fa fa-fw fa-users",
          href: $scope.getUrl("/customer"),
        });
        $scope.mainLinks.push({
          text: "Data Sources",
          icon: "fa fa-fw fa-database",
          href: $scope.getUrl("/datasources"),
        });
      }
    };

    $scope.loadOrgs = function() {
      $scope.orgMenu = [];

      if (contextSrv.hasRole('Admin')) {
        $scope.orgMenu.push({
          text: "公司信息设置",
          href: $scope.getUrl("/org"),
        });
        $scope.orgMenu.push({
          text: "用户管理",
          href: $scope.getUrl("/org/users"),
        });
        if(contextSrv.isGrafanaAdmin){
          $scope.orgMenu.push({
            text: "密钥管理",
            href: $scope.getUrl("/org/apikeys"),
          });
        }
      }

      if ($scope.orgMenu.length > 0) {
        $scope.orgMenu.push({ cssClass: 'divider' });
      }

      backendSrv.get('/api/user/orgs').then(function(orgs) {
        _.each(orgs, function(org) {
          if (org.orgId === contextSrv.user.orgId) {
            return;
          }

          $scope.orgMenu.push({
            text: "切换到" + org.name,
            icon: "fa fa-fw fa-random",
            click: function() {
              $scope.switchOrg(org.orgId);
            }
          });
        });

        if (config.allowOrgCreate) {
          $scope.orgMenu.push({
            text: "新建公司",
            icon: "fa fa-fw fa-plus",
            href: $scope.getUrl('/org/new')
          });
        }
      });
    };

    $scope.switchOrg = function(orgId) {
      backendSrv.post('/api/user/using/' + orgId).then(function() {
        window.location.href = $scope.getUrl('/');
      });
    };

    $scope.setupAdminNav = function() {
      $scope.systemSection = true;
      $scope.grafanaVersion = config.buildInfo.version;

      /*
      $scope.mainLinks.push({
        text: "System info",
        icon: "fa fa-fw fa-info",
        href: $scope.getUrl("/admin/settings"),
      });
      */

      $scope.mainLinks.push({
        text: "全体成员",
        icon: "fa fa-fw fa-user",
        href: $scope.getUrl("/admin/users"),
      });

      $scope.mainLinks.push({
        text: "所有公司",
        icon: "fa fa-fw fa-users",
        href: $scope.getUrl("/admin/orgs"),
      });
    };

    $scope.setupSystemMenu = function () {
      $scope.mainLinks.push({
        text: "智能分析面板",
        icon: "fa fa-fw fa-th-large",
        href: $scope.getUrl(contextSrv.dashboardLink)
      });

      $scope.mainLinks.push({
        text: "报警&关联分析",
        icon: "fa fa-fw fa-bell",
        href: $scope.getUrl("/alerts/status")
      });

      $scope.mainLinks.push({
        text: "实时健康状态",
        icon: "fa fa-fw fa-ambulance",
        href: $scope.getUrl("/health")
      });

      $scope.mainLinks.push({
        text: "实时告警通知",
        icon: "fa fa-fw fa-phone",
        href: $scope.getUrl("/oncallers")
      });

      $scope.mainLinks.push({
        text: "自动异常检测",
        icon: "fa fa-fw fa-stethoscope",
        href: $scope.getUrl("/anomaly")
      });

      // $scope.mainLinks.push({
      //   text: "指标聚类分析",
      //   icon: "fa fa-fw fa-area-chart",
      //   href: $scope.getUrl("/cluster")
      // });

      // sinoRails would need this
      // $scope.mainLinks.push({
      //   text: "长期分析预测",
      //   icon: "fa fa-fw fa-line-chart",
      //   href: $scope.getUrl("/analysis")
      // });

      $scope.mainLinks.push({
        text: "关联分析",
        icon: "fa fa-fw fa-line-chart",
        href: $scope.getUrl("/association")
      });

      $scope.mainLinks.push({
        text: "日志管理查询",
        icon: "fa fa-fw fa-search",
        href: $scope.getUrl("/logs")
      });

      $scope.mainLinks.push({
        text: "返回主页",
        icon: "fa fa-fw fa-backward",
        href: $scope.getUrl("/"),
      });
    };

    $scope.updateMenu = function() {
      $scope.systemSection = false;
      $scope.mainLinks = [];
      $scope.orgMenu = [];
      $scope.dashboardTitle = "";
      var currentPath = $location.path();
      if (currentPath.indexOf('/admin') === 0) {
        $scope.setupAdminNav();
      } else if (currentPath.indexOf('/alerts') == 0
                  || currentPath.indexOf('/oncallers') == 0
                  || currentPath.indexOf('/anomaly') == 0
                  || currentPath.indexOf('/analysis') == 0
                  || currentPath.indexOf('/association') == 0
                  || currentPath.indexOf('/logs') == 0
                  || currentPath.indexOf('/decompose') == 0
                  || currentPath.indexOf('/health') == 0
                  || currentPath.indexOf('/cluster') == 0
                  || currentPath.indexOf('/integrate') == 0
      ) {
        if (contextSrv.system == 0){
          $location.url("/");
          $scope.appEvent('alert-warning', ['非法操作', '已为您跳转到主页']);
          return;
        }
        $scope.setupSystemMenu();
      } else if(currentPath.indexOf('/dashboard/db/') == 0){
        contextSrv.dashboardLink = currentPath;
        $scope.setupSystemMenu();
      } else {
        $scope.setupMainNav();
      }
    };

    $scope.init = function() {
      $scope.updateMenu();
      $scope.$on('$routeChangeSuccess', $scope.updateMenu);
    };
  });

});
