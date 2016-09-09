///<reference path="../../headers/common.d.ts" />

import './editor_ctrl';

import angular from 'angular';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';

export class AnnotationsSrv {
  globalAnnotationsPromise: any;

  /** @ngInject */
  constructor(private $rootScope,
              private $q,
              private datasourceSrv,
              private backendSrv,
              private timeSrv) {
    $rootScope.onAppEvent('refresh', this.clearCache.bind(this), $rootScope);
    $rootScope.onAppEvent('dashboard-initialized', this.clearCache.bind(this), $rootScope);
  }

  clearCache() {
    this.globalAnnotationsPromise = null;
  }

  getAnnotations(options) {
    return this.$q.all([
      this.getGlobalAnnotations(options),
      this.getPanelAnnotations(options)
    ]).then(allResults => {
      return _.flatten(allResults);
    }).catch(err => {
      this.$rootScope.appEvent('alert-error', ['Annotations failed', (err.message || err)]);
    });
  }

  getPanelAnnotations(options) {
    var panel = options.panel;
    var dashboard = options.dashboard;

    if (panel && panel.alert && panel.alert.enabled) {
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

  getGlobalAnnotations(options) {
    var dashboard = options.dashboard;

    if (dashboard.annotations.list.length === 0) {
      return this.$q.when([]);
    }

    if (this.globalAnnotationsPromise) {
      return this.globalAnnotationsPromise;
    }

    var annotations = _.where(dashboard.annotations.list, {enable: true});
    var range = this.timeSrv.timeRange();

    this.globalAnnotationsPromise = this.$q.all(_.map(annotations, annotation => {
      if (annotation.snapshotData) {
        return this.translateQueryResult(annotation, annotation.snapshotData);
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
        return this.translateQueryResult(annotation, results);
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
}

coreModule.service('annotationsSrv', AnnotationsSrv);
