///<reference path="../../headers/common.d.ts" />

import './editor_ctrl';

import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';

export class AnnotationsSrv {
  globalAnnotationsPromise: any;
  alertStatesPromise: any;

  /** @ngInject */
  constructor(private $rootScope,
              private $q,
              private datasourceSrv,
              private backendSrv,
              private timeSrv,
              private templateSrv) {
    $rootScope.onAppEvent('refresh', this.clearCache.bind(this), $rootScope);
    $rootScope.onAppEvent('dashboard-initialized', this.clearCache.bind(this), $rootScope);
  }

  clearCache() {
    this.globalAnnotationsPromise = null;
    this.alertStatesPromise = null;
  }

  getAnnotations(options) {
    return this.$q.all([
      this.getGlobalAnnotations(options),
      this.getPanelAnnotations(options),
      this.getAlertStates(options)
    ]).then(results => {

      // combine the annotations and flatten results
      var annotations = _.flattenDeep([results[0], results[1]]);

      // look for alert state for this panel
      var alertState = _.find(results[2], {panelId: options.panel.id});

      return {
        annotations: annotations,
        alertState: alertState,
      };

    }).catch(err => {
      this.$rootScope.appEvent('alert-error', ['Annotations failed', (err.message || err)]);
    });
  }

  getPanelAnnotations(options) {
    var panel = options.panel;
    var dashboard = options.dashboard;

    if (panel && panel.alert) {
      return this.backendSrv.get('/api/annotations', {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        limit: 100,
        panelId: panel.id,
        dashboardId: dashboard.id,
      }).then(results => {
        return this.translateQueryResult({iconColor: '#AA0000', name: 'panel-alert'}, results);
      });
    }

    return this.$q.when([]);
  }

  getAlertStates(options) {
    if (!options.dashboard.id) {
      return this.$q.when([]);
    }

    // ignore if no alerts
    if (options.panel && !options.panel.alert) {
      return this.$q.when([]);
    }

    if (options.range.raw.to !== 'now') {
      return this.$q.when([]);
    }

    if (this.alertStatesPromise) {
      return this.alertStatesPromise;
    }

    this.alertStatesPromise = this.backendSrv.get('/api/alerts/states-for-dashboard', {dashboardId: options.dashboard.id});
    return this.alertStatesPromise;
  }

  getGlobalAnnotations(options) {
    var dashboard = options.dashboard;

    if (dashboard.annotations.list.length === 0) {
      return this.$q.when([]);
    }

    if (this.globalAnnotationsPromise) {
      return this.globalAnnotationsPromise;
    }

    var annotations = _.filter(dashboard.annotations.list, {enable: true});
    var range = this.timeSrv.timeRange();
    var tagPattern = new RegExp(this.templateSrv.replace(options.panel.annotationFilter.tag, options.panel.scopedVars, 'regex'));

    this.globalAnnotationsPromise = this.$q.all(_.map(annotations, annotation => {
      if (annotation.snapshotData) {
        var filteredSnapshot = this.filterAnnotationsByTagPattern(annotation.snapshotData, tagPattern);
        return this.translateQueryResult(annotation, filteredSnapshot);
      }

      return this.datasourceSrv.get(annotation.datasource).then(datasource => {
        // issue query against data source
        return datasource.annotationQuery({range: range, rangeRaw: range.raw, annotation: annotation});
      })
      .then(results => {
        // store response in annotation object if this is a snapshot call
        if (dashboard.snapshot) {
          annotation.snapshotData = angular.copy(results);
        }
        // translate result
        var filteredAnnotation = this.filterAnnotationsByTagPattern(results, tagPattern);
        return this.translateQueryResult(annotation, filteredAnnotation);
      });
    }));

    return this.globalAnnotationsPromise;
  }

  translateQueryResult(annotation, results) {
    for (var item of results) {
      item.source = annotation;
      item.min = item.time;
      item.max = item.time;
      item.scope = 1;
      item.eventType = annotation.name;
    }
    return results;
  }

  filterAnnotationsByTagPattern(annotations, tagPattern) {
    return _.filter(annotations, annotation => {
      return _.some(annotation.tags, tag => {
        return tag.match(tagPattern);
      });
    });
  }
}

coreModule.service('annotationsSrv', AnnotationsSrv);
