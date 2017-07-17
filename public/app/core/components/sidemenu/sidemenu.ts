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

  /** @ngInject */
  constructor(private $scope, private $location, private contextSrv, private backendSrv, private $element) {
    this.isSignedIn = contextSrv.isSignedIn;
    this.user = contextSrv.user;
    this.appSubUrl = config.appSubUrl;
    this.showSignout = this.contextSrv.isSignedIn && !config['authProxyEnabled'];

    this.mainLinks = config.bootData.mainNavLinks;
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
      ],
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

    this.openUserDropdown();
    this.$scope.$on('$routeChangeSuccess', () => {
      if (!this.contextSrv.pinned) {
        this.contextSrv.sidemenu = false;
      }
    });
  }

 getUrl(url) {
   return config.appSubUrl + url;
 }

 openUserDropdown() {
   this.orgMenu = [
     {section: 'You', cssClass: 'dropdown-menu-title'},
     {text: 'Profile', url: this.getUrl('/profile')},
   ];

   if (this.isSignedIn) {
     this.orgMenu.push({text: "Sign out", url: this.getUrl("/logout"), target: "_self"});
   }

   if (this.contextSrv.hasRole('Admin')) {
     this.orgMenu.push({section: this.user.orgName, cssClass: 'dropdown-menu-title'});
     this.orgMenu.push({
       text: "Preferences",
       url: this.getUrl("/org"),
     });
     this.orgMenu.push({
       text: "Users",
       url: this.getUrl("/org/users"),
     });
     this.orgMenu.push({
       text: "API Keys",
       url: this.getUrl("/org/apikeys"),
     });
   }

   this.orgMenu.push({cssClass: "divider"});

   this.backendSrv.get('/api/user/orgs').then(orgs => {
     orgs.forEach(org => {
       if (org.orgId === this.contextSrv.user.orgId) {
         return;
       }

       this.orgMenu.push({
         text: "Switch to " + org.name,
         icon: "fa fa-fw fa-random",
         click: () => {
           this.switchOrg(org.orgId);
         }
       });
     });

     if (config.allowOrgCreate) {
       this.orgMenu.push({text: "New organization", icon: "fa fa-fw fa-plus", url: this.getUrl('/org/new')});
     }
   });
 }

 switchOrg(orgId) {
   this.backendSrv.post('/api/user/using/' + orgId).then(() => {
     window.location.href = `${config.appSubUrl}/`;
   });
 };
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
    }
  };
}

coreModule.directive('sidemenu', sideMenuDirective);
