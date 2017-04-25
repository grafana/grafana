define([
  'angular',
  'lodash',
  'jquery',
  '../core_module',
  'app/core/config',
],
function (angular, _, $, coreModule, config) {
  'use strict';

  coreModule.controller('SideMenuCtrl', function($rootScope, $scope, $location, contextSrv, backendSrv) {

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
        text: "指标浏览",
        icon: "fa fa-fw fa-sliders",
        click: $scope.loadDashboardList
      });

      $scope.mainLinks.push({
        text: "日志查看",
        icon: "fa fa-fw fa-file-text-o",
        submenu: [
          {
            text: '全文查询',
            href: $scope.getUrl("/logs")
          },
          {
            text: '聚合查询',
            href: $scope.getUrl("/logs")
          },
          {
            text: '日志对比',
            href: $scope.getUrl("/logs")
          },
        ]
      });

      $scope.mainLinks.push({
        text: "智能检测",
        icon: "fa fa-fw fa-stethoscope",
        submenu: [
          {
            text: '报警规则检测',
            dropdown: 'dropdown',
            thdmenu: [
              {
                text: '当前报警',
                href: $scope.getUrl('/alerts/status'),
              },
              {
                text: '历史报警',
                href: $scope.getUrl('/alerts/history'),
              },
              {
                text: '所有规则',
                href: $scope.getUrl('/alerts'),
              },
              {
                text: '新建规则',
                href: $scope.getUrl('/alerts/new'),
              }
            ]
          },
          {
            text: '自动异常检测',
            href: $scope.getUrl("/anomaly"),
          }
        ]
        // href: $scope.getUrl("/service"),
      });

      $scope.mainLinks.push({
        text: "智能分析",
        icon: "fa fa-fw fa-bar-chart",
        submenu: [
          {
            text: '关联性分析',
            href: $scope.getUrl("/association"),
          },
          {
            text: '运维知识',
            href: $scope.getUrl("/knowledgebase"),
          },
          {
            text: '故障溯源',
            href: '',
          },
          {
            text: '健康报告',
            href: $scope.getUrl('/report'),
          },
        ]
      });

      $scope.mainLinks.push({
        text: "运维轮班",
        icon: "fa fa-fw fa-calendar",
        href: $scope.getUrl("/oncallers"),
      });

      $scope.setupSettingMenu();



    };

    $scope.loadSystems = function () {
    };

    $scope.newDashboard = function() {
      var modalScope = $rootScope.$new();
      $scope.appEvent('show-modal', {
        src: './app/partials/select_system.html',
        modalClass: 'modal-no-header confirm-modal',
        scope: modalScope
      });
    };
    $scope.loadDashboardList = function (menu) {
      var submenu = [];
      backendSrv.search({query: "", starred: "false"}).then(function (result) {
        submenu.push({
          text: "+新建",
          click: $scope.newDashboard,
        });
        _.each(result, function (dash) {
          submenu.push({
            text: dash.title,
            href: $scope.getUrl("dashboard/"+dash.uri),
          })
        });
        menu.submenu = submenu;
        $scope.updateSubmenu(menu);
      });
    };

    $scope.loadOrgs = function (menu) {
      backendSrv.get('/api/user/orgs').then(function (orgs) {
        menu.thdmenu = [];
        _.each(orgs, function (org) {
          if (org.orgId === contextSrv.user.orgId) {
            return;
          }

          menu.thdmenu.push({
            text: org.name,
            icon: "fa fa-fw fa-random",
            click: function () {
              $scope.switchOrg(org.orgId);
            }
          });
        });
        if (!menu.thdmenu.length) {
          menu.thdmenu.push({
            text: "无",
          });
        }
      });
    };

    $scope.setupSettingMenu = function() {
      $scope.settingMenu = {
        text: "信息管理",
        icon: "fa fa-fw fa-cogs",
        submenu: [],
      };

      $scope.settingMenu.submenu.push({
        text: "切换系统",
        href: $scope.getUrl('/systems')
      });

      $scope.settingMenu.submenu.push({
        text: "切换组织",
        dropdown: 'dropdown',
        thdmenu: [],
        click: $scope.loadOrgs
      });

      if ($scope.length > 0) {
        $scope.settingMenu.submenu.push({ cssClass: 'divider' });
      }

      if (config.allowOrgCreate) {
        $scope.settingMenu.submenu.push({
          text: "新建公司",
          icon: "fa fa-fw fa-plus",
          href: $scope.getUrl('/org/new')
        });
      }

      if (contextSrv.hasRole('Admin')) {
        $scope.settingMenu.submenu.push({
          text: "公司信息设置",
          href: $scope.getUrl("/org"),
        });
        $scope.settingMenu.submenu.push({
          text: "用户管理",
          href: $scope.getUrl("/org/users"),
        });
        if(contextSrv.isGrafanaAdmin){
          $scope.settingMenu.submenu.push({
            text: "密钥管理",
            href: $scope.getUrl("/org/apikeys"),
          });
        }
      }

      if (contextSrv.isGrafanaAdmin) {
        $scope.settingMenu.submenu.push({
          text: "后台管理",
          dropdown: 'dropdown',
          thdmenu: [
            {
              text: "System info",
              icon: "fa fa-fw fa-info",
              href: $scope.getUrl("/admin/settings"),
            },
            {
              text: "全体成员",
              icon: "fa fa-fw fa-user",
              href: $scope.getUrl("/admin/users"),
            },
            {
              text: "所有公司",
              icon: "fa fa-fw fa-users",
              href: $scope.getUrl("/admin/orgs"),
            }
          ]
        });
        $scope.settingMenu.submenu.push({
          text: "申请用户",
          icon: "fa fa-fw fa-users",
          href: $scope.getUrl("/customer"),
        });
        $scope.settingMenu.submenu.push({
          text: "数据库",
          icon: "fa fa-fw fa-database",
          href: $scope.getUrl("/datasources"),
        });
      }

      $scope.settingMenu.submenu.push({
        text: "系统状况",
        href: $scope.getUrl("/service"),
      });

      $scope.settingMenu.submenu.push({
        text: "探针状态",
        href: $scope.getUrl("/summary"),
      });

      $scope.settingMenu.submenu.push({
        text: "安装指南",
        href: $scope.getUrl("/install"),
      });

      $scope.settingMenu.submenu.push({
        text: "帮助文档",
        href: "http://cloudwiz.cn/document/",
      });
    };

    $scope.switchOrg = function(orgId) {
      backendSrv.post('/api/user/using/' + orgId).then(function() {
        window.location.href = $scope.getUrl('/');
      });
    };

    $scope.updateMenu = function() {
      $scope.systemSection = false;
      $scope.mainLinks = [];
      $scope.dashboardTitle = "";
      if (contextSrv.system == 0 && contextSrv.user.orgId) {
        $location.url("/systems");
        contextSrv.sidmenu = false;
        return;
      }
      var currentPath = $location.path();
      if (currentPath.indexOf('/admin') === 0) {
        $scope.setupAdminNav();
      } else if(currentPath.indexOf('/dashboard/db/') == 0){
        contextSrv.dashboardLink = currentPath;
      }
      $scope.setupMainNav();
    };

    $scope.updateSubmenu = function(menu) {
      if(menu.submenu){
        $scope.submenu = menu.submenu;
        contextSrv.submenu = true;
        $scope.currentMenu = {text: menu.text, icon: menu.icon};
      } else {
        contextSrv.submenu = false;
      }
    };

    $scope.hideSubmenu = function() {
      contextSrv.submenu = false;
    };

    $scope.init = function() {
      $scope.hideSubmenu();
      $scope.updateMenu();
      $scope.$on('$routeChangeSuccess', $scope.hideSubmenu);
    };
  });

});
