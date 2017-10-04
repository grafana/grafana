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
      .all([this.getGlobalAnnotations(options), this.getPanelAnnotations(options), this.getAlertStates(options)])
      .then(results => {
        // combine the annotations and flatten results
        var annotations = _.flattenDeep([results[0], results[1]]);

        // filter out annotations that do not belong to requesting panel
        annotations = _.filter(annotations, item => {
          if (item.panelId && options.panel.id !== item.panelId) {
            return false;
          }
          return true;
        });

        annotations = dedupAnnotations(annotations);
        annotations = makeRegions(annotations, options);

        // look for alert state for this panel
        var alertState = _.find(results[2], {panelId: options.panel.id});

        return {
          annotations: annotations,
          alertState: alertState,
        };
      })
      .catch(err => {
        if (!err.message && err.data && err.data.message) {
          err.message = err.data.message;
        }
        this.$rootScope.appEvent('alert-error', ['Annotation Query Failed', err.message || err]);

        return [];
      });
  }

  getPanelAnnotations(options) {
    // var panel = options.panel;
    // var dashboard = options.dashboard;
    //
    // if (dashboard.id && panel && panel.alert) {
    //   return this.backendSrv.get('/api/annotations', {
    //     from: options.range.from.valueOf(),
    //     to: options.range.to.valueOf(),
    //     limit: 100,
    //     panelId: panel.id,
    //     dashboardId: dashboard.id,
    //   }).then(results => {
    //     // this built in annotation source name `panel-alert` is used in annotation tooltip
    //     // to know that this annotation is from panel alert
    //     return this.translateQueryResult({iconColor: '#AA0000', name: 'panel-alert'}, results);
    //   });
    // }
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

    this.alertStatesPromise = this.backendSrv.get('/api/alerts/states-for-dashboard', {
      dashboardId: options.dashboard.id,
    });
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

    this.globalAnnotationsPromise = this.$q.all(
      _.map(annotations, annotation => {
        if (annotation.snapshotData) {
          return this.translateQueryResult(annotation, annotation.snapshotData);
        }

        return this.datasourceSrv
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
          });
      }),
    );

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
      item.min = item.time;
      item.max = item.time;
      item.scope = 1;
      item.eventType = annotation.name;
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
        region_obj.timeEnd = region_events[1].min;
        region_obj.isRegion = true;
        return region_obj;
      } else {
        if (region_events && region_events.length) {
          // Don't change proper region object
          if (!region_obj.min || !region_obj.timeEnd) {
            // This is cut region
            if (isStartOfRegion(region_obj)) {
              region_obj.timeEnd = range.to.valueOf() - 1;
            } else {
              // Start time = null
              region_obj.timeEnd = region_obj.min;
              region_obj.min = range.from.valueOf() + 1;
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
