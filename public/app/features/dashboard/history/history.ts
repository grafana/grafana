///<reference path="../../../headers/common.d.ts" />

import './history_srv';

import _ from 'lodash';
import angular from 'angular';
import moment from 'moment';

import {DashboardModel} from '../model';
import {HistoryListOpts, RevisionsModel} from './models';

export class HistoryListCtrl {
  appending: boolean;
  dashboard: DashboardModel;
  delta: { basic: string; html: string; };
  diff: string;
  limit: number;
  loading: boolean;
  max: number;
  mode: string;
  revisions: RevisionsModel[];
  selected: number[];
  start: number;

  /** @ngInject */
  constructor(private $scope,
              private $rootScope,
              private $route,
              private $window,
              private $timeout,
              private $q,
              private contextSrv,
              private historySrv) {
    $scope.ctrl = this;

    this.appending = false;
    this.diff = 'basic';
    this.limit = 10;
    this.loading = false;
    this.max = 2;
    this.mode = 'list';
    this.selected = [];
    this.start = 0;

    this.resetFromSource();

    $scope.$watch('ctrl.mode', newVal => {
      $window.scrollTo(0, 0);
      if (newVal === 'list') {
        this.reset();
      }
    });

    $rootScope.onAppEvent('dashboard-saved', this.onDashboardSaved.bind(this));
  }

  dismiss() {
    this.$rootScope.appEvent('hide-dash-editor');
  }

  addToLog() {
    this.start = this.start + this.limit;
    this.getLog(true);
  }

  compareRevisionStateChanged(revision: any) {
    if (revision.checked) {
      this.selected.push(revision.version);
    } else {
      _.remove(this.selected, version => version === revision.version);
    }
    this.selected = _.sortBy(this.selected);
  }

  compareRevisionDisabled(checked: boolean) {
    return (this.selected.length === this.max && !checked) || this.revisions.length === 1;
  }

  formatDate(date) {
    date = moment.isMoment(date) ? date : moment(date);
    const format = 'YYYY-MM-DD HH:mm:ss';

    return this.dashboard.timezone === 'browser' ?
      moment(date).format(format) :
      moment.utc(date).format(format);
  }

  formatBasicDate(date) {
    const now = this.dashboard.timezone === 'browser' ?  moment() : moment.utc();
    const then = this.dashboard.timezone === 'browser' ?  moment(date) : moment.utc(date);
    return then.from(now);
  }

  getDiff(diff: string) {
    if (!this.isComparable()) { return; } // disable button but not tooltip

    this.diff = diff;
    this.mode = 'compare';
    this.loading = true;

    // instead of using lodash to find min/max we use the index
    // due to the array being sorted in ascending order
    const compare = {
      new: this.selected[1],
      original: this.selected[0],
    };

    if (this.delta[this.diff]) {
      this.loading = false;
      return this.$q.when(this.delta[this.diff]);
    } else {
      return this.historySrv.compareVersions(this.dashboard, compare, diff).then(response => {
        this.delta[this.diff] = response;
      }).catch(err => {
        this.mode = 'list';
        this.$rootScope.appEvent('alert-error', ['There was an error fetching the diff', (err.message || err)]);
      }).finally(() => { this.loading = false; });
    }
  }

  getLog(append = false) {
    this.loading = !append;
    this.appending = append;
    const options: HistoryListOpts = {
      limit: this.limit,
      start: this.start,
    };

    return this.historySrv.getHistoryList(this.dashboard, options).then(revisions => {
      this.revisions = append ? this.revisions.concat(revisions) : revisions;
    }).catch(err => {
      this.$rootScope.appEvent('alert-error', ['There was an error fetching the history list', (err.message || err)]);
    }).finally(() => {
      this.loading = false;
      this.appending = false;
    });
  }

  getMeta(version: number, property: string) {
    const revision = _.find(this.revisions, rev => rev.version === version);
    return revision[property];
  }

  isOriginalCurrent() {
    return this.selected[1] === this.dashboard.version;
  }

  isComparable() {
    const isParamLength = this.selected.length === 2;
    const areNumbers = this.selected.every(version => _.isNumber(version));
    const areValidVersions = _.filter(this.revisions, revision => {
      return revision.version === this.selected[0] || revision.version === this.selected[1];
    }).length === 2;
    return isParamLength && areNumbers && areValidVersions;
  }

  isLastPage() {
    return _.find(this.revisions, rev => rev.version === 1);
  }

  onDashboardSaved() {
    this.$rootScope.appEvent('hide-dash-editor');
  }

  reset() {
    this.delta = { basic: '', html: '' };
    this.diff = 'basic';
    this.mode = 'list';
    this.revisions = _.map(this.revisions, rev => _.extend({}, rev, { checked: false }));
    this.selected = [];
    this.start = 0;
  }

  resetFromSource() {
    this.revisions = [];
    return this.getLog().then(this.reset.bind(this));
  }

  restore(version: number) {
    this.$rootScope.appEvent('confirm-modal', {
      title: 'Restore version',
      text: '',
      text2: `Are you sure you want to restore the dashboard to version ${version}? All unsaved changes will be lost.`,
      icon: 'fa-history',
      yesText: `Yes, restore to version ${version}`,
      onConfirm: this.restoreConfirm.bind(this, version),
    });
  }

  restoreConfirm(version: number) {
    this.loading = true;
    return this.historySrv.restoreDashboard(this.dashboard, version).then(response => {
      this.$route.reload();
      this.$rootScope.appEvent('alert-success', ['Dashboard restored', 'Restored from version ' + version]);
    }).finally(() => {
      this.loading = false;
    });
  }
}

export function dashboardHistoryDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/history/history.html',
    controller: HistoryListCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "="
    }
  };
}

angular.module('grafana.directives').directive('gfDashboardHistory', dashboardHistoryDirective);
