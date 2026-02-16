import { cloneDeep } from 'lodash';
import { lazy, Suspense, useMemo } from 'react';

import { applyFieldOverrides, PrometheusQueryResultsV1Props } from '@grafana/data';
import { config, getTemplateSrv } from '@grafana/runtime';

const RawPrometheusContainerPureLazy = lazy(() =>
  import('./RawPrometheusContainerPure').then((m) => ({ default: m.RawPrometheusContainerPure }))
);

/**
 * EXPOSED COMPONENT (stable): grafana/prometheus-query-results/v1
 *
 * This component is exposed to plugins via the Plugin Extensions system.
 * Treat its props and user-visible behavior as a stable contract. Do not make
 * breaking changes in-place. If you need to change the API or behavior in a
 * breaking way, create a new versioned component (e.g. PrometheusQueryResultsV2)
 * and register it under a new ID: "grafana/prometheus-query-results/v2".
 *
 * Displays Prometheus query results with Table/Raw toggle.
 * Pass raw DataFrames - processing (applyFieldOverrides) is handled internally.
 *
 * Example usage in a plugin:
 * ```typescript
 * import { usePluginComponent } from '@grafana/runtime';
 * import { PluginExtensionExposedComponents } from '@grafana/data';
 *
 * const { component: PrometheusQueryResults } = usePluginComponent(
 *   PluginExtensionExposedComponents.PrometheusQueryResultsV1
 * );
 *
 * // Render - just pass raw data
 * <PrometheusQueryResults tableResult={rawDataFrames} width={800} timeZone="browser" />
 * ```
 */
export const PrometheusQueryResultsContainer = (props: PrometheusQueryResultsV1Props) => {
  const width = props.width ?? 800;
  const timeZone = props.timeZone ?? 'browser';

  // Memoize cloneDeep + applyFieldOverrides to avoid expensive operations on every render
  // cloneDeep is needed to avoid mutating frozen props from plugin extension system
  const processedData = useMemo(() => {
    const tableResult = props.tableResult ?? [];
    const cloned = cloneDeep(tableResult);
    if (cloned?.length) {
      return applyFieldOverrides({
        data: cloned,
        timeZone,
        theme: config.theme2,
        replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        fieldConfig: { defaults: {}, overrides: [] },
        dataLinkPostProcessor: props.dataLinkPostProcessor,
      });
    }
    return cloned;
  }, [props.tableResult, timeZone, props.dataLinkPostProcessor]);

  return (
    <Suspense fallback={null}>
      <RawPrometheusContainerPureLazy
        tableResult={processedData}
        width={width}
        loading={props.loading}
        ariaLabel={props.ariaLabel}
        showRawPrometheus={props.showRawPrometheus}
        onCellFilterAdded={props.onCellFilterAdded}
      />
    </Suspense>
  );
};
