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
        text: "指标浏览",
        icon: "fa fa-fw fa-sliders",
        href: 'javascript:void(0);',
      });

      $scope.mainLinks.push({
        text: "日志查看",
        icon: "fa fa-fw fa-file-text-o",
        href: 'javascript:void(0);',
        submenu: [
          {
            text: '日志管理查询',
            href: $scope.getUrl("/logs")
          },
          {
            text: '日志对比',
            href: 'javascript:void(0);',
          },
        ]
      });

      $scope.mainLinks.push({
        text: "智能检测",
        icon: "fa fa-fw fa-stethoscope",
        href: 'javascript:void(0);',
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
        href: 'javascript:void(0);',
        submenu: [
          {
            text: '关联性分析',
            href: '',
          },
          {
            text: '知识库',
            href: '',
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

      // $scope.mainLinks.push({
      //   text: "系统状况",
      //   icon: "fa fa-fw fa-cubes",
      //   href: $scope.getUrl("/service"),
      // });

      // $scope.mainLinks.push({
      //   text: "探针状态",
      //   icon: "fa fa-fw fa-crosshairs",
      //   href: $scope.getUrl("/summary"),
      // });

    };

    $scope.loadSystems = function() {
    };

    $scope.loadOrgs = function() {

      backendSrv.get('/api/user/orgs').then(function(orgs) {
        _.each(orgs, function(org) {
          if (org.orgId === contextSrv.user.orgId) {
            return;
          }

          $scope.settingMenu.submenu[1].thdmenu.push({
            text: org.name,
            icon: "fa fa-fw fa-random",
            click: function() {
              $scope.switchOrg(org.orgId);
            }
          });
        });

        if (config.allowOrgCreate) {
          $scope.settingMenu.submenu.push({
            text: "新建公司",
            icon: "fa fa-fw fa-plus",
            href: $scope.getUrl('/org/new')
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
        dropdown: 'dropdown',
        thdmenu: [],
        click: $scope.loadSystems()
      });

      $scope.settingMenu.submenu.push({
        text: "切换组织",
        dropdown: 'dropdown',
        thdmenu: [],
        click: function() {
          $scope.loadOrgs()
        }
      });

      if ($scope.length > 0) {
        $scope.settingMenu.submenu.push({ cssClass: 'divider' });
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
          ],
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
        text: "安装指南",
        href: $scope.getUrl("/install"),
      });
    }

    $scope.switchOrg = function(orgId) {
      backendSrv.post('/api/user/using/' + orgId).then(function() {
        window.location.href = $scope.getUrl('/');
      });
    };

    $scope.updateMenu = function() {
      $scope.systemSection = false;
      $scope.mainLinks = [];
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
                  || currentPath.indexOf('/knowledgebase') == 0
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
