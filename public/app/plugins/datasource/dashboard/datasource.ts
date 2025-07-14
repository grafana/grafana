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
  AdHocVariableFilter,
  MetricFindValue,
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
              // Enable AdHoc filtering for string and numeric fields
              filterable: field.type === FieldType.string || field.type === FieldType.number,
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
   * Optimized version with pre-computed field indices for better performance
   */
  private applyAdHocFilters(frame: DataFrame, filters: AdHocVariableFilter[]): DataFrame {
    if (filters.length === 0 || frame.length === 0) {
      return frame;
    }

    // Pre-compute field indices for better performance - O(m × f) instead of O(n × m × f)
    const filterFieldIndices = filters
      .map((filter) => {
        const fieldIndex = frame.fields.findIndex((f) => f.name === filter.key);
        return { filter, fieldIndex };
      })
      .filter(({ filter, fieldIndex }) => {
        // If field is not present:
        // - Keep filters with '=' operator (will always be false - reject rows)
        // - Remove filters with '!=' operator (will always be true - no effect)
        if (fieldIndex === -1) {
          return filter.operator === '=';
        }
        return true;
      });

    // If no filters remain after optimization, return original frame
    if (filterFieldIndices.length === 0) {
      return frame;
    }

    // Short-circuit: if any filter has '=' operator with missing field, reject all rows
    const hasImpossibleFilter = filterFieldIndices.some(({ fieldIndex }) => fieldIndex === -1);
    if (hasImpossibleFilter) {
      return this.reconstructDataFrame(frame, new Set<number>());
    }

    const matchingRows = new Set<number>();

    // Check each row to see if it matches all filters (AND logic)
    for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
      const rowMatches = filterFieldIndices.every(({ filter, fieldIndex }) => {
        // Handle case where field doesn't exist (fieldIndex === -1)
        if (fieldIndex === -1) {
          return this.compareUnsupportedValues(null, filter);
        }

        const field = frame.fields[fieldIndex];
        const fieldValue = field.values[rowIndex];

        // Use unified evaluation method that dispatches based on field type
        return this.evaluateFilter(fieldValue, filter, field.type);
      });

      if (rowMatches) {
        matchingRows.add(rowIndex);
      }
    }

    return this.reconstructDataFrame(frame, matchingRows);
  }

  /**
   * Evaluate a filter against a field value - unified method that dispatches based on field type
   */
  private evaluateFilter(fieldValue: any, filter: AdHocVariableFilter, fieldType: FieldType): boolean {
    // Handle null/undefined values consistently across all types
    if (fieldValue == null) {
      return filter.operator === '!=' && filter.value !== '';
    }

    // Dispatch to type-specific comparison logic
    const compareFn = this.getComparisonFunction(fieldType);
    return compareFn(fieldValue, filter);
  }

  /**
   * Get the appropriate comparison function based on field type
   */
  private getComparisonFunction(fieldType: FieldType) {
    switch (fieldType) {
      case FieldType.string:
        return this.compareStringValues;
      case FieldType.number:
        return this.compareNumericValues;
      // Easy to extend for future types:
      // case FieldType.time:
      //   return this.compareDateValues;
      default:
        return this.compareUnsupportedValues; // Skip unknown types
    }
  }

  /**
   * Compare string field values
   */
  private compareStringValues = (fieldValue: any, filter: AdHocVariableFilter): boolean => {
    const filterValue = filter.value;

    switch (filter.operator) {
      case '=':
        return fieldValue === filterValue;
      case '!=':
        return fieldValue !== filterValue;
      default:
        // Unknown operator, skip this filter
        return true;
    }
  };

  /**
   * Compare numeric field values (integers and floats)
   */
  private compareNumericValues = (fieldValue: any, filter: AdHocVariableFilter): boolean => {
    // Parse filter value as a number
    const filterValue = parseFloat(filter.value);

    // If filter value is not a valid number, skip this filter
    if (isNaN(filterValue)) {
      return true;
    }

    // Ensure field value is a number
    const numericFieldValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(fieldValue);

    // If field value is not a valid number, skip this filter
    if (isNaN(numericFieldValue)) {
      return true;
    }

    switch (filter.operator) {
      case '=':
        return numericFieldValue === filterValue;
      case '!=':
        return numericFieldValue !== filterValue;
      // Easy to add more operators:
      // case '>':
      //   return numericFieldValue > filterValue;
      // case '<':
      //   return numericFieldValue < filterValue;
      default:
        // Unknown operator, skip this filter
        return true;
    }
  };

  /**
   * Handle unsupported field types
   */
  private compareUnsupportedValues = (_fieldValue: any, _filter: AdHocVariableFilter): boolean => {
    // unknown field type, skip this filter
    return true;
  };

  /**
   * Reconstruct DataFrame with only matching rows
   * Optimized to avoid repeated array operations
   */
  private reconstructDataFrame(frame: DataFrame, matchingRows: Set<number>): DataFrame {
    const fields: Field[] = frame.fields.map((field) => {
      const newValues = Array.from(matchingRows, (rowIndex) => field.values[rowIndex]);

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

  getTagKeys(): Promise<MetricFindValue[]> {
    // Stub implementation to indicate AdHoc filter support
    // Full implementation will be added in future PRs
    return Promise.resolve([]);
  }
}
