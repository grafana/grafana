// Libaries
import flattenDeep from 'lodash/flattenDeep';
import cloneDeep from 'lodash/cloneDeep';
// Components
import './editor_ctrl';
import coreModule from 'app/core/core_module';
// Utils & Services
import { dedupAnnotations } from './events_processing';
// Types
import { DashboardModel, PanelModel } from '../dashboard/state';
import { AnnotationEvent, AppEvents, DataSourceApi, PanelEvents, TimeRange } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { getTimeSrv } from '../dashboard/services/TimeSrv';

export class AnnotationsSrv {
  globalAnnotationsPromise: any;
  alertStatesPromise: any;
  datasourcePromises: any;

  init(dashboard: DashboardModel) {
    // always clearPromiseCaches when loading new dashboard
    this.clearPromiseCaches();
    // clear promises on refresh events
    dashboard.on(PanelEvents.refresh, this.clearPromiseCaches.bind(this));
  }

  clearPromiseCaches() {
    this.globalAnnotationsPromise = null;
    this.alertStatesPromise = null;
    this.datasourcePromises = null;
  }

  getAnnotations(options: { dashboard: DashboardModel; panel: PanelModel; range: TimeRange }) {
    return Promise.all([this.getGlobalAnnotations(options), this.getAlertStates(options)])
      .then(results => {
        // combine the annotations and flatten results
        let annotations: AnnotationEvent[] = flattenDeep(results[0]);
        // when in edit mode we need to use this function to get the saved id
        let panelFilterId = options.panel.getSavedId();

        // filter out annotations that do not belong to requesting panel
        annotations = annotations.filter(item => {
          // if event has panel id and query is of type dashboard then panel and requesting panel id must match
          if (item.panelId && item.source.type === 'dashboard') {
            return item.panelId === panelFilterId;
          }
          return true;
        });

        annotations = dedupAnnotations(annotations);

        // look for alert state for this panel
        const alertState: any = results[1].find((res: any) => res.panelId === panelFilterId);

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
        appEvents.emit(AppEvents.alertError, ['Annotation Query Failed', err.message || err]);
        return [];
      });
  }

  getAlertStates(options: any) {
    if (!options.dashboard.id) {
      return Promise.resolve([]);
    }

    // ignore if no alerts
    if (options.panel && !options.panel.alert) {
      return Promise.resolve([]);
    }

    if (options.range.raw.to !== 'now') {
      return Promise.resolve([]);
    }

    if (this.alertStatesPromise) {
      return this.alertStatesPromise;
    }

    this.alertStatesPromise = getBackendSrv().get(
      '/api/alerts/states-for-dashboard',
      {
        dashboardId: options.dashboard.id,
      },
      `get-alert-states-${options.dashboard.id}`
    );

    return this.alertStatesPromise;
  }

  getGlobalAnnotations(options: { dashboard: DashboardModel; panel: PanelModel; range: TimeRange }) {
    const dashboard = options.dashboard;

    if (this.globalAnnotationsPromise) {
      return this.globalAnnotationsPromise;
    }

    const range = getTimeSrv().timeRange();
    const promises = [];
    const dsPromises = [];

    for (const annotation of dashboard.annotations.list) {
      if (!annotation.enable) {
        continue;
      }

      if (annotation.snapshotData) {
        return this.translateQueryResult(annotation, annotation.snapshotData);
      }
      const datasourcePromise = getDataSourceSrv().get(annotation.datasource);
      dsPromises.push(datasourcePromise);
      promises.push(
        datasourcePromise
          .then((datasource: DataSourceApi) => {
            // issue query against data source
            return datasource.annotationQuery({
              range,
              rangeRaw: range.raw,
              annotation: annotation,
              dashboard: dashboard,
            });
          })
          .then(results => {
            // store response in annotation object if this is a snapshot call
            if (dashboard.snapshot) {
              annotation.snapshotData = cloneDeep(results);
            }
            // translate result
            return this.translateQueryResult(annotation, results);
          })
      );
    }
    this.datasourcePromises = Promise.all(dsPromises);
    this.globalAnnotationsPromise = Promise.all(promises);
    return this.globalAnnotationsPromise;
  }

  saveAnnotationEvent(annotation: AnnotationEvent) {
    this.globalAnnotationsPromise = null;
    return getBackendSrv().post('/api/annotations', annotation);
  }

  updateAnnotationEvent(annotation: AnnotationEvent) {
    this.globalAnnotationsPromise = null;
    return getBackendSrv().put(`/api/annotations/${annotation.id}`, annotation);
  }

  deleteAnnotationEvent(annotation: AnnotationEvent) {
    this.globalAnnotationsPromise = null;
    const deleteUrl = `/api/annotations/${annotation.id}`;

    return getBackendSrv().delete(deleteUrl);
  }

  translateQueryResult(annotation: any, results: any) {
    // if annotation has snapshotData
    // make clone and remove it
    if (annotation.snapshotData) {
      annotation = cloneDeep(annotation);
      delete annotation.snapshotData;
    }

    for (const item of results) {
      item.source = annotation;
      item.isRegion = item.timeEnd && item.time !== item.timeEnd;
    }

    return results;
  }
}

coreModule.service('annotationsSrv', AnnotationsSrv);
