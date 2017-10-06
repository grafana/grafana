import './editor_ctrl';

import angular from 'angular';
import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class AnnotationsSrv {
  globalAnnotationsPromise: any;
  alertStatesPromise: any;

  /** @ngInject */
  constructor(private $rootScope, private $q, private datasourceSrv, private backendSrv, private timeSrv) {
    $rootScope.onAppEvent('refresh', this.clearCache.bind(this), $rootScope);
    $rootScope.onAppEvent('dashboard-initialized', this.clearCache.bind(this), $rootScope);
  }

  clearCache() {
    this.globalAnnotationsPromise = null;
    this.alertStatesPromise = null;
  }

  getAnnotations(options) {
    return this.$q
      .all([this.getGlobalAnnotations(options), this.getAlertStates(options)])
      .then(results => {
        // combine the annotations and flatten results
        var annotations = _.flattenDeep(results[0]);

        // filter out annotations that do not belong to requesting panel
        annotations = _.filter(annotations, item => {
          // if event has panel id and query is of type dashboard then panel and requesting panel id must match
          if (item.panelId && item.source.type === 'dashboard') {
            return item.panelId === options.panel.id;
          }
          return true;
        });

        annotations = dedupAnnotations(annotations);
        annotations = makeRegions(annotations, options);

        // look for alert state for this panel
        var alertState = _.find(results[1], {panelId: options.panel.id});

        return {
          annotations: annotations,
          alertState: alertState,
        };
      })
      .catch(err => {
        if (!err.message && err.data && err.data.message) {
          err.message = err.data.message;
        }
        console.log('AnnotationSrv.query error', err);
        this.$rootScope.appEvent('alert-error', ['Annotation Query Failed', err.message || err]);
        return [];
      });
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

    this.alertStatesPromise = this.backendSrv.get('/api/alerts/states-for-dashboard', {
      dashboardId: options.dashboard.id,
    });
    return this.alertStatesPromise;
  }

  getGlobalAnnotations(options) {
    var dashboard = options.dashboard;

    if (this.globalAnnotationsPromise) {
      return this.globalAnnotationsPromise;
    }

    var range = this.timeSrv.timeRange();
    var promises = [];

    for (let annotation of dashboard.annotations.list) {
      if (!annotation.enable) {
        continue;
      }

      if (annotation.snapshotData) {
        return this.translateQueryResult(annotation, annotation.snapshotData);
      }

      promises.push(
        this.datasourceSrv
          .get(annotation.datasource)
          .then(datasource => {
            // issue query against data source
            return datasource.annotationQuery({
              range: range,
              rangeRaw: range.raw,
              annotation: annotation,
              dashboard: dashboard,
            });
          })
          .then(results => {
            // store response in annotation object if this is a snapshot call
            if (dashboard.snapshot) {
              annotation.snapshotData = angular.copy(results);
            }
            // translate result
            return this.translateQueryResult(annotation, results);
          })
      );
    }

    this.globalAnnotationsPromise = this.$q.all(promises);
    return this.globalAnnotationsPromise;
  }

  saveAnnotationEvent(annotation) {
    this.globalAnnotationsPromise = null;
    return this.backendSrv.post('/api/annotations', annotation);
  }

  updateAnnotationEvent(annotation) {
    this.globalAnnotationsPromise = null;
    return this.backendSrv.put(`/api/annotations/${annotation.id}`, annotation);
  }

  deleteAnnotationEvent(annotation) {
    this.globalAnnotationsPromise = null;
    let deleteUrl = `/api/annotations/${annotation.id}`;
    if (annotation.isRegion) {
      deleteUrl = `/api/annotations/region/${annotation.regionId}`;
    }

    return this.backendSrv.delete(deleteUrl);
  }

  translateQueryResult(annotation, results) {
    // if annotation has snapshotData
    // make clone and remove it
    if (annotation.snapshotData) {
      annotation = angular.copy(annotation);
      delete annotation.snapshotData;
    }

    for (var item of results) {
      item.source = annotation;
    }
    return results;
  }
}

/**
 * This function converts annotation events into set
 * of single events and regions (event consist of two)
 * @param annotations
 * @param options
 */
function makeRegions(annotations, options) {
  let [regionEvents, singleEvents] = _.partition(annotations, 'regionId');
  let regions = getRegions(regionEvents, options.range);
  annotations = _.concat(regions, singleEvents);
  return annotations;
}

function getRegions(events, range) {
  let region_events = _.filter(events, event => {
    return event.regionId;
  });
  let regions = _.groupBy(region_events, 'regionId');
  regions = _.compact(
    _.map(regions, region_events => {
      let region_obj = _.head(region_events);
      if (region_events && region_events.length > 1) {
        region_obj.timeEnd = region_events[1].time;
        region_obj.isRegion = true;
        return region_obj;
      } else {
        if (region_events && region_events.length) {
          // Don't change proper region object
          if (!region_obj.time || !region_obj.timeEnd) {
            // This is cut region
            if (isStartOfRegion(region_obj)) {
              region_obj.timeEnd = range.to.valueOf() - 1;
            } else {
              // Start time = null
              region_obj.timeEnd = region_obj.time;
              region_obj.time = range.from.valueOf() + 1;
            }
            region_obj.isRegion = true;
          }

          return region_obj;
        }
      }
    }),
  );

  return regions;
}

function isStartOfRegion(event): boolean {
  return event.id && event.id === event.regionId;
}

function dedupAnnotations(annotations) {
  let dedup = [];

  // Split events by annotationId property existance
  let events = _.partition(annotations, 'id');

  let eventsById = _.groupBy(events[0], 'id');
  dedup = _.map(eventsById, eventGroup => {
    if (eventGroup.length > 1 && !_.every(eventGroup, isPanelAlert)) {
      // Get first non-panel alert
      return _.find(eventGroup, event => {
        return event.eventType !== 'panel-alert';
      });
    } else {
      return _.head(eventGroup);
    }
  });

  dedup = _.concat(dedup, events[1]);
  return dedup;
}

function isPanelAlert(event) {
  return event.eventType === 'panel-alert';
}

coreModule.service('annotationsSrv', AnnotationsSrv);
