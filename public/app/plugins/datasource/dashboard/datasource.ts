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
  getValueMatcher,
  ValueMatcherID,
  DataSourceGetDrilldownsApplicabilityOptions,
  DrilldownsApplicability,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneDataProvider, SceneDataTransformer, SceneObject } from '@grafana/scenes';
import {
  activateSceneObjectAndParentTree,
  findVizPanelByKey,
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

    let sourcePanel = findVizPanelByKey(scene, getVizPanelKeyForPanelId(panelId));

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
    const adHocFilters = options.filters || [];

    return defer(() => {
      if (!sourceDataProvider!.isActive && sourceDataProvider?.setContainerWidth) {
        sourceDataProvider?.setContainerWidth(500);
      }

      /**
       * Ignore the isInView flag on the original data provider
       * This allows queries to be run even if the original datasource is outside the viewport
       */
      sourceDataProvider?.bypassIsInViewChanged?.(true);

      const activateCleanUp = activateSceneObjectAndParentTree(sourceDataProvider!);

      return sourceDataProvider!.getResultsStream!().pipe(
        debounceTime(50),
        map((result) => {
          return {
            data: this.getDataFramesForQueryTopic(result.data, query, adHocFilters),
            state: result.data.state,
            errors: result.data.errors,
            error: result.data.error,
            key: 'source-ds-provider',
          };
        }),
        this.emitFirstLoadedDataIfMixedDS(options.requestId),
        finalize(() => {
          sourceDataProvider?.bypassIsInViewChanged?.(false);

          activateCleanUp?.();
        })
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
              // Enable AdHoc filtering for string and numeric fields only when feature toggle and per-panel setting are enabled
              filterable:
                config.featureToggles.dashboardDsAdHocFiltering && query.adHocFiltersEnabled
                  ? field.type === FieldType.string || field.type === FieldType.number
                  : field.config.filterable,
            },
            state: {
              ...field.state,
            },
          })),
        };
      });

      if (!config.featureToggles.dashboardDsAdHocFiltering || !query.adHocFiltersEnabled || filters.length === 0) {
        return [...series, ...annotations];
      }

      // Apply AdHoc filters to series data
      const filteredSeries = series.map((frame) => this.applyAdHocFilters(frame, filters));
      return [...filteredSeries, ...annotations];
    }
  }

  /**
   * Apply AdHoc filters to a DataFrame
   * Optimized version with pre-computed field indices and value matchers for better performance
   */
  private applyAdHocFilters(frame: DataFrame, filters: AdHocVariableFilter[]): DataFrame {
    if (filters.length === 0 || frame.length === 0) {
      return frame;
    }

    // Filter out non-applicable filters for this specific DataFrame
    const applicableFilters = this.getApplicableFiltersForFrame(frame, filters);

    // If no filters remain after filtering, return original frame
    if (applicableFilters.length === 0) {
      return frame;
    }

    // Check for impossible filters (missing field with '=' operator)
    const hasImpossibleFilter = applicableFilters.some(
      ({ fieldIndex, filter }) => fieldIndex === -1 && filter.operator === '='
    );
    if (hasImpossibleFilter) {
      return this.reconstructDataFrame(frame);
    }

    const matchingRows = new Set<number>();

    // Check each row to see if it matches all filters (AND logic)
    for (let rowIndex = 0; rowIndex < frame.length; rowIndex++) {
      const rowMatches = applicableFilters.every(({ matcher, fieldIndex }) => {
        const field = frame.fields[fieldIndex];

        // Use Grafana's value matcher system
        return matcher?.(rowIndex, field, frame, [frame]) ?? false;
      });

      if (rowMatches) {
        matchingRows.add(rowIndex);
      }
    }

    // Early return if no filtering occurred
    if (matchingRows.size === frame.length) {
      return frame;
    }

    return this.reconstructDataFrame(frame, matchingRows);
  }

  /**
   * Get applicable filters for a specific DataFrame, considering field existence and type compatibility.
   */
  private getApplicableFiltersForFrame(
    frame: DataFrame,
    filters: AdHocVariableFilter[]
  ): Array<{ filter: AdHocVariableFilter; fieldIndex: number; matcher: ReturnType<typeof getValueMatcher> | null }> {
    return filters
      .map((filter) => {
        const fieldIndex = frame.fields.findIndex((f) => f.name === filter.key);
        return { filter, fieldIndex, matcher: this.createValueMatcher(filter, fieldIndex, frame) };
      })
      .filter(({ filter, fieldIndex, matcher }) => {
        // If field is not present:
        // - Keep filters with '=' operator (will always be false - reject rows)
        // - Remove filters with '!=' operator (will always be true - no effect)
        if (fieldIndex === -1) {
          return filter.operator === '=';
        }
        // Only keep filters with valid matchers
        return matcher !== null;
      });
  }

  /**
   * Create a value matcher from an AdHoc filter.
   */
  private createValueMatcher(filter: AdHocVariableFilter, fieldIndex: number, frame: DataFrame) {
    // Return null for missing fields - they are handled separately
    if (fieldIndex === -1) {
      return null;
    }

    const field = frame.fields[fieldIndex];

    // Only support string and numeric fields when feature toggle is enabled
    if (config.featureToggles.dashboardDsAdHocFiltering) {
      if (field.type !== FieldType.string && field.type !== FieldType.number) {
        return null;
      }
    }

    // Map operator to matcher ID
    let matcherId: ValueMatcherID;
    switch (filter.operator) {
      case '=':
        matcherId = ValueMatcherID.equal;
        break;
      case '!=':
        matcherId = ValueMatcherID.notEqual;
        break;
      default:
        return null; // Unknown operator
    }

    try {
      return getValueMatcher({
        id: matcherId,
        options: { value: filter.value },
      });
    } catch (error) {
      console.warn('Failed to create value matcher for filter:', filter, error);
      return null;
    }
  }

  /**
   * Reconstruct DataFrame with only matching rows
   * Optimized to avoid repeated array operations
   */
  private reconstructDataFrame(frame: DataFrame, matchingRows?: Set<number>): DataFrame {
    // Default to empty set if no matching rows provided (reject all rows)
    const rows = matchingRows ?? new Set<number>();

    const fields: Field[] = frame.fields.map((field) => {
      // Pre-allocate array and use direct assignment for better performance with large datasets
      const newValues = new Array(rows.size);
      let i = 0;
      for (const rowIndex of rows) {
        newValues[i++] = field.values[rowIndex];
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
      length: rows.size,
    };
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
   * Check which AdHoc filters are applicable based on operator and field type support
   */
  async getDrilldownsApplicability(
    options?: DataSourceGetDrilldownsApplicabilityOptions<DashboardQuery>
  ): Promise<DrilldownsApplicability[]> {
    if (!config.featureToggles.dashboardDsAdHocFiltering) {
      return [];
    }

    // Check if any query has adhoc filters enabled
    const hasAdHocFiltersEnabled = options?.queries?.some((query) => query.adHocFiltersEnabled);

    if (!hasAdHocFiltersEnabled) {
      return [];
    }

    const filters = options?.filters || [];

    return filters.map((filter): DrilldownsApplicability => {
      // Check operator support
      if (filter.operator !== '=' && filter.operator !== '!=') {
        return {
          key: filter.key,
          applicable: false,
          reason: `Operator '${filter.operator}' is not supported. Only '=' and '!=' operators are supported.`,
        };
      }

      // For dashboard datasource, we can't determine field existence/type
      // without the actual DataFrame context, so we assume applicable here
      // and let the actual filtering logic handle field-specific checks
      return {
        key: filter.key,
        applicable: true,
      };
    });
  }

  getTagKeys(): Promise<MetricFindValue[]> {
    // Stub implementation to indicate AdHoc filter support
    // Full implementation will be added in future PRs
    return Promise.resolve([]);
  }
}
