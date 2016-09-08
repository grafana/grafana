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
              private timeSrv) {
    $rootScope.onAppEvent('refresh', this.clearCache.bind(this), $rootScope);
    $rootScope.onAppEvent('dashboard-initialized', this.clearCache.bind(this), $rootScope);
  }

  clearCache() {
    this.globalAnnotationsPromise = null;
  }

  getAnnotations(dashboard) {
    if (dashboard.annotations.list.length === 0) {
      return this.$q.when(null);
    }

    if (this.globalAnnotationsPromise) {
      return this.globalAnnotationsPromise;
    }

    var annotations = _.where(dashboard.annotations.list, {enable: true});
    var range = this.timeSrv.timeRange();
    var rangeRaw = this.timeSrv.timeRange(false);

    this.globalAnnotationsPromise = this.$q.all(_.map(annotations, annotation => {
      if (annotation.snapshotData) {
        return this.translateQueryResult(annotation.snapshotData);
      }

      return this.datasourceSrv.get(annotation.datasource).then(datasource => {
        // issue query against data source
        return datasource.annotationQuery({
          range: range,
          rangeRaw:
          rangeRaw,
          annotation: annotation
        });
      })
      .then(results => {
        // store response in annotation object if this is a snapshot call
        if (dashboard.snapshot) {
          annotation.snapshotData = angular.copy(results);
        }
        // translate result
        return this.translateQueryResult(results);
      });
    }))
    .then(allResults => {
      return _.flatten(allResults);
    }).catch(err => {
      this.$rootScope.appEvent('alert-error', ['Annotations failed', (err.message || err)]);
    });

    return this.globalAnnotationsPromise;
  }

  translateQueryResult(results) {
    var translated = [];

    for (var item of results) {
      translated.push({
        annotation: item.annotation,
        min: item.time,
        max: item.time,
        eventType: item.annotation.name,
        title: item.title,
        tags: item.tags,
        text: item.text,
        score: 1
      });
    }

    return translated;
  }
}

coreModule.service('annotationsSrv', AnnotationsSrv);
