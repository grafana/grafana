import { Observable, debounce, debounceTime, defer, finalize, first, interval, map, of } from 'rxjs';

import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  TestDataSourceResponse,
  ScopedVar,
  DataTopic,
  PanelData,
  DataFrame,
  LoadingState,
  Field,
  FieldType,
  MetricFindValue,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  AdHocVariableFilter,
} from '@grafana/data';
import { SceneDataProvider, SceneDataTransformer, SceneObject } from '@grafana/scenes';
import {
  activateSceneObjectAndParentTree,
  findOriginalVizPanelByKey,
  getVizPanelKeyForPanelId,
} from 'app/features/dashboard-scene/utils/utils';

import { MIXED_REQUEST_PREFIX } from '../mixed/MixedDataSource';

import { DashboardQuery } from './types';

/**
 * This should not really be called
 */
export class DashboardDatasource extends DataSourceApi<DashboardQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  getCollapsedText(query: DashboardQuery) {
    return `Dashboard Reference: ${query.panelId}`;
  }

  query(options: DataQueryRequest<DashboardQuery>): Observable<DataQueryResponse> {
    const sceneScopedVar: ScopedVar | undefined = options.scopedVars?.__sceneObject;
    let scene: SceneObject | undefined = sceneScopedVar ? (sceneScopedVar.value.valueOf() as SceneObject) : undefined;

    if (!scene) {
      throw new Error('Can only be called from a scene');
    }

    const query = options.targets[0];
    if (!query) {
      return of({ data: [] });
    }

    const panelId = query.panelId;

    if (!panelId) {
      return of({ data: [] });
    }

    let sourcePanel = this.findSourcePanel(scene, panelId);

    if (!sourcePanel) {
      return of({ data: [], error: { message: 'Could not find source panel' } });
    }

    let sourceDataProvider: SceneDataProvider | undefined = sourcePanel.state.$data;

    if (!query.withTransforms && sourceDataProvider instanceof SceneDataTransformer) {
      sourceDataProvider = sourceDataProvider.state.$data;
    }

    if (!sourceDataProvider || !sourceDataProvider.getResultsStream) {
      return of({ data: [] });
    }

    // Extract AdHoc filters from the request
    const adhocFilters = options.filters || [];

    return defer(() => {
      if (!sourceDataProvider!.isActive && sourceDataProvider?.setContainerWidth) {
        sourceDataProvider?.setContainerWidth(500);
      }

      const cleanUp = activateSceneObjectAndParentTree(sourceDataProvider!);

      return sourceDataProvider!.getResultsStream!().pipe(
        debounceTime(50),
        map((result) => {
          return {
            data: this.getDataFramesForQueryTopic(result.data, query, adhocFilters),
            state: result.data.state,
            errors: result.data.errors,
            error: result.data.error,
            key: 'source-ds-provider',
          };
        }),
        this.emitFirstLoadedDataIfMixedDS(options.requestId),
        finalize(() => cleanUp?.())
      );
    });
  }

  private getDataFramesForQueryTopic(
    data: PanelData,
    query: DashboardQuery,
    filters: AdHocVariableFilter[]
  ): DataFrame[] {
    const annotations = data.annotations ?? [];
    if (query.topic === DataTopic.Annotations) {
      return annotations.map((frame) => ({
        ...frame,
        meta: {
          ...frame.meta,
          dataTopic: DataTopic.Series,
        },
      }));
    } else {
      const series = data.series.map((s) => {
        return {
          ...s,
          fields: s.fields.map((field: Field) => ({
            ...field,
            config: {
              ...field.config,
              // Enable AdHoc filtering for string fields (similar to Loki/Prometheus pattern)
              filterable: field.type === FieldType.string,
            },
            state: {
              ...field.state,
            },
          })),
        };
      });

      // Apply AdHoc filters to series data (copied and simplified from filterByValue.ts)
      const filteredSeries =
        filters.length > 0 ? series.map((frame) => this.applyAdHocFilters(frame, filters)) : series;

      return [...filteredSeries, ...annotations];
    }
  }

  /**
   * Apply AdHoc filters to a DataFrame
   * Simplified version of the filterByValue transformer logic for string fields only
   */
  private applyAdHocFilters(frame: DataFrame, filters: AdHocVariableFilter[]): DataFrame {
    if (filters.length === 0 || frame.length === 0) {
      return frame;
    }

    const matchingRows = new Set<number>();

    // Check each row to see if it matches all filters (AND logic)
    for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
      const rowMatches = filters.every((filter) => {
        // Find the field for this filter
        const field = frame.fields.find((f) => f.name === filter.key);

        // Skip if field doesn't exist or isn't a string field
        if (!field || field.type !== FieldType.string) {
          return true; // Ignore filters for non-string fields
        }

        const fieldValue = field.values[rowIndex];
        const filterValue = filter.value;

        // Apply the filter based on operator
        switch (filter.operator) {
          case '=':
            return fieldValue === filterValue;
          case '!=':
            return fieldValue !== filterValue;
          default:
            // Unknown operator, skip this filter
            return true;
        }
      });

      if (rowMatches) {
        matchingRows.add(rowIndex);
      }
    }

    // Reconstruct the DataFrame with only matching rows
    const fields: Field[] = frame.fields.map((field) => {
      const newValues = [];

      for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
        if (matchingRows.has(rowIndex)) {
          newValues.push(field.values[rowIndex]);
        }
      }

      return {
        ...field,
        values: newValues,
        state: {}, // Clean the state as it's being recalculated
      };
    });

    return {
      ...frame,
      fields: fields,
      length: matchingRows.size,
    };
  }

  private findSourcePanel(scene: SceneObject, panelId: number) {
    // We're trying to find the original panel, not a cloned one, since `panelId` alone cannot resolve clones
    return findOriginalVizPanelByKey(scene, getVizPanelKeyForPanelId(panelId));
  }

  private emitFirstLoadedDataIfMixedDS(
    requestId: string
  ): (source: Observable<DataQueryResponse>) => Observable<DataQueryResponse> {
    return (source: Observable<DataQueryResponse>) => {
      if (requestId.includes(MIXED_REQUEST_PREFIX)) {
        let count = 0;

        return source.pipe(
          /*
           * We can have the following piped values scenarios:
           * Loading -> Done         - initial load
           * Done -> Loading -> Done - refresh
           * Done                    - adding another query in editor
           *
           * When we see Done as a first element this is because of ReplaySubject in SceneQueryRunner
           *
           * we use first(...) below to emit correct result which is last value with Done/Error states
           *
           * to avoid emitting first Done/Error (due to ReplaySubject) we selectively debounce only first value with such states
           */
          debounce((val) => {
            if ([LoadingState.Done, LoadingState.Error].includes(val.state!) && count === 0) {
              count++;
              // in the refresh scenario we need to debounce first Done/Error until Loading arrives
              //   400ms here is a magic number that was sufficient enough with the 20x cpu throttle
              //   this still might affect slower machines but the issue affects only panel view/edit modes
              return interval(400);
            }
            count++;
            return interval(0);
          }),
          first((val) => val.state === LoadingState.Done || val.state === LoadingState.Error)
        );
      }

      return source;
    };
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ message: '', status: '' });
  }

  /**
   * Get tag keys for adhoc filters
   * Returns commonly available field names that can be used as filter keys
   */
  async getTagKeys(options?: DataSourceGetTagKeysOptions): Promise<MetricFindValue[]> {
    // For now, return a basic set of commonly available field names
    // Later, this could be enhanced to dynamically discover fields from dashboard panels
    const commonFields = [
      'Time',
      'Value',
      'host',
      'instance',
      'job',
      'service',
      'container',
      'pod',
      'namespace',
      'environment',
      'region',
      'zone',
      'cluster',
      'node',
      'application',
      'version',
      'status',
      'method',
      'path',
      'code',
      'level',
      'logger',
      'component',
      'source',
      'target',
      'type',
      'name',
      'label',
      'tag',
      'category',
      'group',
      'team',
      'owner',
    ];

    // Filter out keys that are already being used in existing filters
    const usedKeys = new Set(options?.filters?.map((f) => f.key) || []);
    const availableKeys = commonFields.filter((key) => !usedKeys.has(key));

    return availableKeys.map((key) => ({ text: key }));
  }

  /**
   * Get tag values for adhoc filters
   * Returns possible values for a given filter key
   */
  async getTagValues(options: DataSourceGetTagValuesOptions): Promise<MetricFindValue[]> {
    const { key } = options;

    // For now, return some common placeholder values based on the key
    // Later, this could be enhanced to dynamically discover values from dashboard panels
    const commonValues: Record<string, string[]> = {
      environment: ['production', 'staging', 'development', 'test'],
      status: ['success', 'error', 'warning', 'info'],
      level: ['error', 'warn', 'info', 'debug'],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      code: ['200', '201', '400', '401', '403', '404', '500', '502', '503'],
      region: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'],
      zone: ['us-east-1a', 'us-east-1b', 'us-west-2a', 'us-west-2b'],
      namespace: ['default', 'kube-system', 'monitoring', 'logging'],
      container: ['app', 'sidecar', 'init', 'proxy'],
      service: ['api', 'frontend', 'backend', 'database', 'cache'],
      application: ['web-app', 'api-server', 'worker', 'scheduler'],
      version: ['v1.0.0', 'v1.1.0', 'v2.0.0', 'latest'],
      type: ['request', 'response', 'system', 'application'],
      category: ['business', 'system', 'security', 'performance'],
      team: ['backend', 'frontend', 'devops', 'data'],
      owner: ['team-a', 'team-b', 'team-c', 'platform'],
    };

    const values = commonValues[key.toLowerCase()] || ['value1', 'value2', 'value3'];

    return values.map((value) => ({ text: value }));
  }
}
