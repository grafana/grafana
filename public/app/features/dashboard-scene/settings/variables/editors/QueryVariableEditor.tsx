import { FormEvent } from 'react';
import * as React from 'react';

import { SelectableValue, DataSourceInstanceSettings, getDataSourceRef, AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { QueryVariable, sceneGraph } from '@grafana/scenes';
import { VariableRefresh, VariableSort } from '@grafana/schema';
import { t } from 'app/core/internationalization';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { FEATURE_CONST, getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';

import { QueryVariableEditorForm } from '../components/QueryVariableForm';
import { containsDirectTimeRangeVariables, isServiceManagementQuery, deleteVariableCache } from '../utils';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onRunQuery: () => void;
}
type VariableQueryType = QueryVariable['state']['query'];

export function QueryVariableEditor({ variable, onRunQuery }: QueryVariableEditorProps) {
  const {
    datasource,
    regex,
    sort,
    refresh,
    isMulti,
    includeAll,
    allValue,
    query,
    allowCustomValue,
    // @ts-expect-error
    discardForAll,
    // @ts-expect-error
    bmcVarCache,
  } = variable.useState();
  const { value: timeRange } = sceneGraph.getTimeRange(variable).useState();

  const onRegExChange = (event: React.FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ regex: event.currentTarget.value });
  };
  const onSortChange = (sort: SelectableValue<VariableSort>) => {
    variable.setState({ sort: sort.value });
  };
  const onRefreshChange = (refresh: VariableRefresh) => {
    variable.setState({ refresh: refresh });
  };
  const onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ isMulti: event.currentTarget.checked });
  };
  const onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };
  const onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allValue: event.currentTarget.value });
  };
  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };
  const onDataSourceChange = (dsInstanceSettings: DataSourceInstanceSettings) => {
    const datasource = getDataSourceRef(dsInstanceSettings);

    if ((variable.state.datasource?.type || '') !== datasource.type) {
      variable.setState({ datasource, query: '', definition: '' });
      return;
    }

    variable.setState({ datasource });
  };
  const onQueryChange = (query: VariableQueryType) => {
    let definition: string;
    if (typeof query === 'string') {
      definition = query;
    } else if (query.hasOwnProperty('query') && typeof query.query === 'string') {
      definition = query.query;
    }
    // BMC code starts
    // for visual query builder queries
    else if (typeof query.sourceQuery?.rawQuery === 'string') {
      definition = query.sourceQuery.rawQuery;
    }
    // BMC code ends
    else {
      definition = '';
    }
    // BMC code starts - For deleting variable cache when query changes
    // @ts-expect-error
    if (variable.state.bmcVarCache) {
      const dashboardUID = getDashboardSrv().getCurrent()?.uid;
      deleteVariableCache(variable.state, dashboardUID, true);
    }
    // BMC code ends

    variable.setState({ query, definition });
    onRunQuery();
  };

  // BMC Change: Starts
  const onIncludeOnlyAvailable = (event: FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    variable.setState({ discardForAll: event.currentTarget.checked });
  };

  const onBmcVariableCacheChange = (event: FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    variable.setState({ bmcVarCache: event.currentTarget.checked });
  };

  let enableVariableCachingToggle = false;
  const hasValidQuery =
    variable.state.definition !== '' ||
    (typeof variable.state.query === 'object' &&
      variable.state.query !== null &&
      ((variable.state.query as any).sourceQuery?.rawQuery ||
        (variable.state.query as any).sourceQuery?.view?.selectedFields?.length > 0));

  if (getFeatureStatus(FEATURE_CONST.BHD_ENABLE_VAR_CACHING) && hasValidQuery) {
    let errorMsg = '';
    // Only supports service management type queries
    if (isServiceManagementQuery(variable.state.query || '')) {
      enableVariableCachingToggle = true;
    } else {
      errorMsg = t(
        'bmc.variables.query-editor.variable-caching.service-management-error',
        'Caching is supported only for Service Management queries'
      );
    }

    // Logic for enabling toggle based on dependencies:
    // 1. If time range is present in variable query -> Toggle is disabled by default

    if (enableVariableCachingToggle) {
      const hasTimeRangeVars = containsDirectTimeRangeVariables(variable.state.definition as string);

      if (hasTimeRangeVars) {
        enableVariableCachingToggle = false;
        errorMsg = t(
          'bmc.variables.query-editor.variable-caching.dependant-error',
          'Caching for time range dependent variables not allowed'
        );
      }
    }

    // Show error if enableVariableCachingToggle is false + property was set to true
    if (!enableVariableCachingToggle && bmcVarCache) {
      const appEvents = getAppEvents();
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [errorMsg],
      });

      // If enableVariableCachingToggle is false + property was set to true, send an event equivalent to the toggle being unchecked to force it being unchecked on UI and dashboard JSON
      onBmcVariableCacheChange?.({
        currentTarget: { checked: false },
      } as FormEvent<HTMLInputElement>);
    }
  }

  // BMC Change: Ends

  return (
    <QueryVariableEditorForm
      datasource={datasource ?? undefined}
      onDataSourceChange={onDataSourceChange}
      query={query}
      onQueryChange={onQueryChange}
      onLegacyQueryChange={onQueryChange}
      timeRange={timeRange}
      regex={regex}
      onRegExChange={onRegExChange}
      sort={sort}
      onSortChange={onSortChange}
      refresh={refresh}
      onRefreshChange={onRefreshChange}
      isMulti={!!isMulti}
      onMultiChange={onMultiChange}
      includeAll={!!includeAll}
      onIncludeAllChange={onIncludeAllChange}
      allValue={allValue ?? ''}
      onAllValueChange={onAllValueChange}
      allowCustomValue={allowCustomValue}
      onAllowCustomValueChange={onAllowCustomValueChange}
      // BMC Code: Below all props
      onIncludeOnlyAvailable={onIncludeOnlyAvailable}
      discardForAll={discardForAll}
      bmcVarCache={bmcVarCache || false}
      OnBmcVariableCacheChange={onBmcVariableCacheChange}
      enableVariableCachingToggle={enableVariableCachingToggle}
    />
  );
}
