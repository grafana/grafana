///<reference path="../../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../../core_module';

export class SideMenuCtrl {
  isSignedIn: boolean;
  showSignout: boolean;
  user: any;
  mainLinks: any;
  orgMenu: any;
  appSubUrl: string;
  bottomLinks: any;
  submenu: any;
  $rootScope: any;
  configMenu: any;

  /** @ngInject */
  constructor($rootScope, private $scope, private $location, private contextSrv, private backendSrv, private $element) {
    this.isSignedIn = contextSrv.isSignedIn;
    this.user = contextSrv.user;
    this.appSubUrl = config.appSubUrl;
    this.showSignout = this.contextSrv.isSignedIn && !config['authProxyEnabled'];
    this.mainLinks = [];
    this.bottomLinks = [];
    this.contextSrv.setPinnedState(true);
    this.contextSrv.sidemenu = true;
    this.$rootScope = $rootScope;
    this.configMenu = config.bootData.mainNavLinks;
    var _self = this;
    this.updateMenu.bind(this)();
    if (this.contextSrv.isSignedIn) {
      this.getMenus.bind(this)();
    }

    this.$scope.$on('$routeChangeSuccess', () => {
      $scope.showSubmenu = false;
    });

    $scope.updateSubmenu = (item) => {
      if (item.url) {
        $scope.showSubmenu = false;
        $location.url(item.url);
        return;
      }
      if (item.click) {
        item.click(item, _self);
      } else {
        $scope.submenu = item;
      }
      $scope.showSubmenu = true;
    };

    $scope.hideSubmenu = () => {
      $scope.showSubmenu = false;
    };

    $scope.updateThdmenu = (item) => {
      $scope.showSubmenu = false;
      if (item.url) {
        if (item.target === '_blank') {
          window.open(item.url);
        } else {
          $location.url(item.url);
        }
        return;
      }
      if (item.click) {
        item.click(_self);
      }
    };
  }

  getMenus() {
    this.mainLinks.push({
      text: "系统总览",
      icon: "fa fa-fw fa-home",
      children: [
        {
          text: '关键指标',
          url: this.getUrl("/")
        },
        {
          text: '服务状态',
          url: this.getUrl("/service")
        },
        {
          text: '机器连接状态',
          url: this.getUrl("/summary")
        },
        {
          text: '服务依赖状态',
          url: this.getUrl("/service_v2")
        },
        {
          text: '创建服务依赖',
          url: this.getUrl("/service_dependency")
        },
      ],
    });

    this.mainLinks.push({
      text: "指标浏览",
      icon: "fa fa-fw fa-sliders",
      click: this.loadDashboardList
    });

    this.mainLinks.push({
      text: "日志查看",
      icon: "fa fa-fw fa-file-text-o",
      children: [
        {
          text: '全文查询',
          url: this.getUrl("/logs")
        },
        {
          text: '聚合查询',
          url: this.getUrl("/logs")
        },
        {
          text: '日志对比',
          url: this.getUrl("/logs")
        },
      ]
    });

    this.mainLinks.push({
      text: "智能检测",
      icon: "fa fa-fw fa-stethoscope",
      children: [
        {
          text: '报警规则检测',
          dropdown: 'dropdown',
          children: [
            {
              text: '当前报警',
              url: this.getUrl('/alerts/status'),
            },
            {
              text: '历史报警',
              url: this.getUrl('/alerts/history'),
            },
            {
              text: '所有规则',
              url: this.getUrl('/alerts'),
            },
            {
              text: '新建规则',
              url: this.getUrl('/alerts/new'),
            }
          ]
        },
        {
          text: '自动异常检测',
          url: this.getUrl("/anomaly"),
        }
      ]
    });

    this.mainLinks.push({
      text: "智能分析",
      icon: "fa fa-fw fa-bar-chart",
      children: [
        {
          text: '关联性分析',
          url: this.getUrl("/association"),
        },
        {
          text: '运维知识',
          url: this.getUrl("/knowledgebase"),
        },
        {
          text: '故障溯源',
          click: this.getSource
        },
        {
          text: '健康报告',
          url: this.getUrl('/report'),
        },
      ]
    });

    this.mainLinks.push({
      text: "运维轮班",
      icon: "fa fa-fw fa-calendar",
      url: this.getUrl("/oncallerschedule"),
    });

    this.mainLinks.push({
      text: "安装指南",
      icon: "fa fa-fw fa-cloud-download",
      children: [
        {
          text: '安装探针',
          url: this.getUrl("/setting/agent"),
        },
        {
          text: '安装服务',
          url: this.getUrl("/setting/service"),
        },
        {
          text: '配置日志服务',
          url: this.getUrl("/setting/filebeat"),
        },
      ]
    });

    this.mainLinks.push({
      text: "配置管理",
      icon: "fa fa-fw fa-cubes",
      children: [
        {
          text: '设备列表',
          url: this.getUrl("/cmdb/hostlist")
        },
        {
          text: '服务列表',
          url: this.getUrl("/cmdb/servicelist")
        },
        {
          text: '设置',
          url: this.getUrl("/cmdb/setup")
        }
      ]
    });

    this.bottomLinks.push({
      text: this.user.name,
      icon: "fa fa-fw fa-user",
      url: this.getUrl('/profile')
    });

    this.bottomLinks.push({
      text: "信息管理",
      icon: "fa fa-fw fa-cogs",
      children: this.getMsgManagementMenu.bind(this)(),
    });

    this.bottomLinks.push({
      text: this.contextSrv.user.orgName,
      icon: "fa fa-fw fa-random",
      click: this.getOrgsMenu,
    });

    this.bottomLinks.push({
      text: this.contextSrv.systemsMap[_.findIndex(this.contextSrv.systemsMap,{'Id': this.contextSrv.user.systemId})].SystemsName,
      icon: "fa fa-fw fa-sitemap",
      url: this.getUrl('/systems')
    });

  };

  getUrl(url) {
    return config.appSubUrl + url;
  };

  switchOrg(orgId, _self) {
    this.backendSrv.post('/api/user/using/' + orgId).then(() => {
      _self.contextSrv.sidemenu = false;
      window.location.href = this.getUrl('/systems');
    });
  };

  getMsgManagementMenu() {
    var item = [];
    if (config.allowOrgCreate) {
      item.push({
        text: "新建公司",
        icon: "fa fa-fw fa-plus",
        url: this.getUrl('/org/new')
      });
    }

    if (this.contextSrv.hasRole('Admin')) {
      item.push({
        text: "公司信息设置",
        url: this.getUrl("/org"),
      });
      item.push({
        text: "用户管理",
        url: this.getUrl("/org/users"),
      });
      if (this.contextSrv.isGrafanaAdmin) {
        item.push({
          text: "密钥管理",
          url: this.getUrl("/org/apikeys"),
        });
      }
    }

    if (this.contextSrv.isGrafanaAdmin) {
      item.push({
        text: "后台管理",
        dropdown: 'dropdown',
        children: [
          {
            text: "系统信息",
            icon: "fa fa-fw fa-info",
            url: this.getUrl("/admin/settings"),
          },
          {
            text: "系统状态",
            icon: "fa fa-fw fa-info",
            url: this.getUrl("/admin/stats"),
          },
          {
            text: "全体成员",
            icon: "fa fa-fw fa-user",
            url: this.getUrl("/admin/users"),
          },
          {
            text: "所有公司",
            icon: "fa fa-fw fa-users",
            url: this.getUrl("/admin/orgs"),
          }
        ]
      });
      item.push({
        text: "申请用户",
        icon: "fa fa-fw fa-users",
        url: this.getUrl("/customer"),
      });
      item.push({
        text: "数据源",
        icon: "icon-gf icon-gf-dashboard",
        url: this.getUrl("/datasources")
      });
    }

    item.push({
      text: "帮助文档",
      url: "http://cloudwiz.cn/document/",
      target: '_blank'
    });

    return item;
  };

  getOrgsMenu(item, _self) {
    _self.backendSrv.get('/api/user/orgs').then(orgs => {
      item.children = [];
      orgs.forEach(org => {
        if (org.orgId === _self.contextSrv.user.orgId) {
          return;
        }

        item.children.push({
          text: org.name,
          icon: "fa fa-fw fa-random",
          click: (_self) => {
            _self.switchOrg(org.orgId, _self);
          }
        });
      });
      _self.$scope.submenu = item;
    });
  };

  loadDashboardList(item, _self) {
    var submenu = [];
    _self.backendSrv.search({query: "", starred: "false"}).then(function (result) {
      submenu.push({
        text: "+新建",
        click: _self.newDashboard,
      });
      submenu.push({
        text: "导入",
        url: "/import/dashboard",
      });
      _.each(result, function (dash) {
        submenu.push({
          text: dash.title,
          url: _self.getUrl("dashboard/"+dash.uri),
        });
      });
      item.children = submenu;
      _self.$scope.submenu = item;
    });
  };

  newDashboard(_self) {
    _self.$rootScope.appEvent('show-modal', {
      src: 'public/app/partials/select_system.html',
      scope: _self.$scope.$new(),
    });
  };

  getSource(_self) {
    _self.$rootScope.appEvent('confirm-modal', {
      title: '故障溯源',
      text: '功能暂未开放，敬请期待',
      icon: 'fa-bell',
      yesText: '确定',
      noText: '关闭',
      modalClass : 'contact-us',
    });
  };

  updateMenu() {
    var currentPath = this.$location.path();
    if (currentPath.indexOf('/dashboard/snapshot') === 0) {
      return;
    }
    if (!this.contextSrv.isSignedIn) {
      this.$location.url("/login");
      return;
    }
    if (!this.contextSrv.systemsMap.length) {
      this.$location.url("/systems");
      return;
    }
    if (this.contextSrv.user.systemId === 0 && this.contextSrv.user.orgId) {
      this.$location.url("/systems");
      return;
    }
    if (!this.isCurrentSystemInSysmtes.bind(this)) {
      this.$location.url("/systems");
      return;
    }
    if (currentPath.indexOf('/admin') === 0) {
      return;
    } else if (currentPath.indexOf('/dashboard/db/') === 0) {
      this.contextSrv.dashboardLink = currentPath;
    } else if (currentPath.indexOf('/login') === 0) {
      return;
    }
  };

  isCurrentSystemInSysmtes() {
    var currId = this.contextSrv.user.systemId;
    if (this.backendSrv.getSystemById(currId) === '') {
      return false;
    }
    return true;
  }
}

export function sideMenuDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/sidemenu/sidemenu.html',
    controller: SideMenuCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {},
    link: function(scope, elem) {
      // hack to hide dropdown menu
      elem.on('click.dropdown', '.dropdown-menu a', function(evt) {
        var menu = $(evt.target).parents('.dropdown-menu');
        var parent = menu.parent();
        menu.detach();

        setTimeout(function() {
          parent.append(menu);
        }, 100);
      });

      scope.$on("$destory", function() {
        elem.off('click.dropdown');
      });

      var onresize = function (event) {
        if ($(window).height() > 800) {
          scope.showTooltip = false;
        } else {
          scope.showTooltip = true;
        };
        if (event) {
          scope.$apply();
        }
      };
      onresize(false);
      window.onresize = onresize;
    }
  };
}

coreModule.directive('sidemenu', sideMenuDirective);
