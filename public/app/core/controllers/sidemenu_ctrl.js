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
        click: $scope.updateSubmenu,
        submenu: [
          {
            text: '关键指标',
            href: $scope.getUrl("/")
          },
          {
            text: '服务状态',
            href: $scope.getUrl("/service")
          },
          {
            text: '机器连接状态',
            href: $scope.getUrl("/summary")
          },
        ],
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
        ],
        click: $scope.updateSubmenu
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
        ],
        click: $scope.updateSubmenu
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
            click: $scope.alertMessage
          },
          {
            text: '健康报告',
            href: $scope.getUrl('/report'),
          },
        ],
        click: $scope.updateSubmenu
      });

      $scope.mainLinks.push({
        text: "运维轮班",
        icon: "fa fa-fw fa-calendar",
        href: $scope.getUrl("/oncallerschedule"),
      });

      $scope.mainLinks.push({
        text: "安装指南",
        icon: "fa fa-fw fa-cloud-download",
        submenu: [
          {
            text: '安装探针',
            href: $scope.getUrl("/setting/agent"),
          },
          {
            text: '安装服务',
            href: $scope.getUrl("/setting/service"),
          },
          {
            text: '配置日志服务',
            href: $scope.getUrl("/setting/filebeat"),
          },
        ],
        click: $scope.updateSubmenu
      });

      $scope.setupSettingMenu();
    };

    $scope.loadSystems = function (menu) {
      window.location.href = $scope.getUrl('/systems');
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
        menu.submenu = [];
        _.each(orgs, function (org) {
          if (org.orgId === contextSrv.user.orgId) {
            return;
          }

          menu.submenu.push({
            text: org.name,
            icon: "fa fa-fw fa-random",
            click: function () {
              $scope.switchOrg(org.orgId);
            }
          });
        });
        if (!menu.submenu.length) {
          menu.submenu.push({
            text: "无",
          });
        }
        $scope.updateSubmenu(menu);
        $scope.currentMenu.text = '切换到';
      });
    };

    $scope.setupSettingMenu = function() {
      $scope.settingMenu = [
        {
          text: "信息管理",
          icon: "fa fa-fw fa-cogs",
          submenu: [],
          click: $scope.updateSubmenu
        },
        {
          text: contextSrv.user.orgName,
          icon: "fa fa-fw fa-random",
          submenu: [],
          click: $scope.loadOrgs
        },
        {
          text: contextSrv.systemsMap[_.findIndex(contextSrv.systemsMap,{'Id': contextSrv.user.systemId})].SystemsName,
          icon: "fa fa-fw fa-sitemap",
          click: $scope.loadSystems
        }
      ];

      $scope.msgManagement = $scope.settingMenu[0];

      if ($scope.length > 0) {
        $scope.msgManagement.submenu.push({ cssClass: 'divider' });
      }

      if (config.allowOrgCreate) {
        $scope.msgManagement.submenu.push({
          text: "新建公司",
          icon: "fa fa-fw fa-plus",
          href: $scope.getUrl('/org/new')
        });
      }

      if (contextSrv.hasRole('Admin')) {
        $scope.msgManagement.submenu.push({
          text: "公司信息设置",
          href: $scope.getUrl("/org"),
        });
        $scope.msgManagement.submenu.push({
          text: "用户管理",
          href: $scope.getUrl("/org/users"),
        });
        if(contextSrv.isGrafanaAdmin){
          $scope.msgManagement.submenu.push({
            text: "密钥管理",
            href: $scope.getUrl("/org/apikeys"),
          });
        }
      }

      if (contextSrv.isGrafanaAdmin) {
        $scope.msgManagement.submenu.push({
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
        $scope.msgManagement.submenu.push({
          text: "申请用户",
          icon: "fa fa-fw fa-users",
          href: $scope.getUrl("/customer"),
        });
        $scope.msgManagement.submenu.push({
          text: "数据库",
          icon: "fa fa-fw fa-database",
          href: $scope.getUrl("/datasources"),
        });
      }

      $scope.msgManagement.submenu.push({
        text: "帮助文档",
        href: "http://cloudwiz.cn/document/",
        target: '_blank'
      });
    };

    $scope.switchOrg = function(orgId) {
      backendSrv.post('/api/user/using/' + orgId).then(function() {
        window.location.href = $scope.getUrl('/systems');
      });
    };

    $scope.updateMenu = function() {
      $scope.systemSection = false;
      $scope.mainLinks = [];
      $scope.dashboardTitle = "";
      if(!contextSrv.isSignedIn) {
        $location.url("/login");
        return;
      }
      if(!contextSrv.systemsMap.length) {
        $location.url("/newcomer");
        return ;
      }
      if(contextSrv.user.systemId == 0 && contextSrv.user.orgId) {
        $location.url("/newcomer");
        return ;
      }
      if (!isCurrentSystemInSysmtes(contextSrv.user.systemId)) {
        $location.url("/systems");
        return ;
      }
      var currentPath = $location.path();
      if (currentPath.indexOf('/admin') === 0) {
        $scope.setupAdminNav();
      } else if(currentPath.indexOf('/dashboard/db/') == 0){
        contextSrv.dashboardLink = currentPath;
      } else if(currentPath.indexOf('/login') == 0){
        return;
      }
      $scope.setupMainNav();
    };

    function isCurrentSystemInSysmtes(currId) {
      if (backendSrv.getSystemById(currId) == '') {
        return false;
      }
      return true;
    }
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

    $scope.alertMessage = function() {
      $scope.appEvent('confirm-modal', {
        title: '',
        text: '功能暂未开放，敬请期待',
        icon: 'fa-bell',
        yesText: '确定',
        modalClass : 'contact-us',
      });
    };

    $scope.init = function() {
      $scope.hideSubmenu();
      $scope.updateMenu();
      $scope.$on('$routeChangeSuccess', $scope.hideSubmenu);
    };
  });

});
