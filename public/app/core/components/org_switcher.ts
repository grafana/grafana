import coreModule from 'app/core/core_module';
import { contextSrv } from 'app/core/services/context_srv';
import config from 'app/core/config';

const template = `
<div class="modal-body">
	<div class="modal-header">
		<h2 class="modal-header-title">
			<i class="fa fa-random"></i>
			<span class="p-l-1">Switch Organization</span>
		</h2>

		<a class="modal-header-close" ng-click="ctrl.dismiss();">
			<i class="fa fa-remove"></i>
		</a>
	</div>

  <div class="modal-content modal-content--has-scroll" grafana-scrollbar>
    <table class="filter-table form-inline">
			<thead>
				<tr>
					<th>Name</th>
					<th>Role</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				<tr ng-repeat="org in ctrl.orgs">
					<td>{{org.name}}</td>
					<td>{{org.role}}</td>
					<td class="text-right">
						<span class="btn btn-primary btn-small" ng-show="org.orgId === ctrl.currentOrgId">
							Current
						</span>
						<a ng-click="ctrl.setUsingOrg(org)" class="btn btn-inverse btn-small" ng-show="org.orgId !== ctrl.currentOrgId">
							Switch to
						</a>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</div>`;

export class OrgSwitchCtrl {
  orgs: any[];
  currentOrgId: any;

  /** @ngInject */
  constructor(private backendSrv) {
    this.currentOrgId = contextSrv.user.orgId;
    this.getUserOrgs();
  }

  getUserOrgs() {
    this.backendSrv.get('/api/user/orgs').then(orgs => {
      this.orgs = orgs;
    });
  }

  setUsingOrg(org) {
    return this.backendSrv.post('/api/user/using/' + org.orgId).then(() => {
      this.setWindowLocation(config.appSubUrl + (config.appSubUrl.endsWith('/') ? '' : '/') + '?orgId=' + org.orgId);
    });
  }

  setWindowLocation(href: string) {
    window.location.href = href;
  }
}

export function orgSwitcher() {
  return {
    restrict: 'E',
    template: template,
    controller: OrgSwitchCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: { dismiss: '&' },
  };
}

coreModule.directive('orgSwitcher', orgSwitcher);
