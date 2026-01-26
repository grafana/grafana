import { FormEvent, useCallback } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, SelectableValue, TimeRange, VariableRegexApplyTo } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { QueryVariable } from '@grafana/scenes';
import { DataSourceRef, VariableRefresh, VariableSort } from '@grafana/schema';
import { Field } from '@grafana/ui';
import { QueryEditor } from 'app/features/dashboard-scene/settings/variables/components/QueryEditor';
import { QueryVariableRegexForm } from 'app/features/dashboard-scene/settings/variables/components/QueryVariableRegexForm';
import { SelectionOptionsForm } from 'app/features/dashboard-scene/settings/variables/components/SelectionOptionsForm';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getVariableQueryEditor } from 'app/features/variables/editor/getVariableQueryEditor';
import { QueryVariableRefreshSelect } from 'app/features/variables/query/QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from 'app/features/variables/query/QueryVariableSortSelect';
import {
  StaticOptionsOrderType,
  StaticOptionsType,
  QueryVariableStaticOptions,
} from 'app/features/variables/query/QueryVariableStaticOptions';

import { VariableLegend } from './VariableLegend';

type VariableQueryType = QueryVariable['state']['query'];

interface QueryVariableEditorFormProps {
  datasource?: DataSourceRef;
  onDataSourceChange: (dsSettings: DataSourceInstanceSettings, preserveQuery?: boolean) => void;
  query: VariableQueryType;
  onQueryChange: (query: VariableQueryType) => void;
  onLegacyQueryChange: (query: VariableQueryType, definition: string) => void;
  timeRange: TimeRange;
  regex: string | null;
  onRegExChange: (event: FormEvent<HTMLTextAreaElement>) => void;
  regexApplyTo?: VariableRegexApplyTo;
  onRegexApplyToChange?: (event: VariableRegexApplyTo) => void;
  sort: VariableSort;
  onSortChange: (option: SelectableValue<VariableSort>) => void;
  refresh: VariableRefresh;
  onRefreshChange: (option: VariableRefresh) => void;
  isMulti: boolean;
  onMultiChange: (event: FormEvent<HTMLInputElement>) => void;
  allowCustomValue?: boolean;
  onAllowCustomValueChange?: (event: FormEvent<HTMLInputElement>) => void;
  includeAll: boolean;
  onIncludeAllChange: (event: FormEvent<HTMLInputElement>) => void;
  allValue: string;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
  staticOptions?: StaticOptionsType;
  staticOptionsOrder?: StaticOptionsOrderType;
  onStaticOptionsChange?: (staticOptions: StaticOptionsType) => void;
  onStaticOptionsOrderChange?: (staticOptionsOrder: StaticOptionsOrderType) => void;
}

export function QueryVariableEditorForm({
  datasource: datasourceRef,
  onDataSourceChange,
  query,
  onQueryChange,
  onLegacyQueryChange,
  timeRange,
  regex,
  onRegExChange,
  regexApplyTo,
  onRegexApplyToChange,
  sort,
  onSortChange,
  refresh,
  onRefreshChange,
  isMulti,
  onMultiChange,
  allowCustomValue,
  onAllowCustomValueChange,
  includeAll,
  onIncludeAllChange,
  allValue,
  onAllValueChange,
  staticOptions,
  staticOptionsOrder,
  onStaticOptionsChange,
  onStaticOptionsOrderChange,
}: QueryVariableEditorFormProps) {
  const { value: dsConfig } = useAsync(async () => {
    const datasource = await getDataSourceSrv().get(datasourceRef ?? '');
    const VariableQueryEditor = await getVariableQueryEditor(datasource);
    const defaultQuery = datasource?.variables?.getDefaultQuery?.();

    if (!query && defaultQuery) {
      const query =
        typeof defaultQuery === 'string' ? defaultQuery : { ...defaultQuery, refId: defaultQuery.refId ?? 'A' };
      onQueryChange(query);
    }

    // update data source if it is not defined in variable model
    if (!datasourceRef) {
      const instanceSettings = getDataSourceSrv().getInstanceSettings({ type: datasource.type, uid: datasource.uid });
      if (instanceSettings) {
        onDataSourceChange(instanceSettings, true);
      }
    }

    return { datasource, VariableQueryEditor };
  }, [datasourceRef]);

  // adjusting type miss match between DataSourcePicker onChange and onDataSourceChange
  const datasourceChangeHandler = useCallback(
    (dsSettings: DataSourceInstanceSettings) => onDataSourceChange(dsSettings),
    [onDataSourceChange]
  );

  const { datasource, VariableQueryEditor } = dsConfig ?? {};

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.query-variable-editor-form.query-options">Query options</Trans>
      </VariableLegend>
      <Field
        label={t('dashboard-scene.query-variable-editor-form.label-data-source', 'Data source')}
        htmlFor="data-source-picker"
      >
        <DataSourcePicker current={datasourceRef} onChange={datasourceChangeHandler} variables={true} width={30} />
      </Field>

      {datasource && VariableQueryEditor && (
        <QueryEditor
          onQueryChange={onQueryChange}
          onLegacyQueryChange={onLegacyQueryChange}
          datasource={datasource}
          query={query}
          VariableQueryEditor={VariableQueryEditor}
          timeRange={timeRange}
        />
      )}

      <QueryVariableRegexForm
        regex={regex}
        regexApplyTo={regexApplyTo}
        onRegExChange={onRegExChange}
        onRegexApplyToChange={onRegexApplyToChange}
      />

      <QueryVariableSortSelect
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelectV2}
        onChange={onSortChange}
        sort={sort}
      />

      <QueryVariableRefreshSelect
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelectV2}
        onChange={onRefreshChange}
        refresh={refresh}
      />

      {onStaticOptionsChange && onStaticOptionsOrderChange && (
        <QueryVariableStaticOptions
          staticOptions={staticOptions}
          staticOptionsOrder={staticOptionsOrder}
          onStaticOptionsChange={onStaticOptionsChange}
          onStaticOptionsOrderChange={onStaticOptionsOrderChange}
        />
      )}

      <VariableLegend>
        <Trans i18nKey="dashboard-scene.query-variable-editor-form.selection-options">Selection options</Trans>
      </VariableLegend>
      <SelectionOptionsForm
        multi={!!isMulti}
        includeAll={!!includeAll}
        allowCustomValue={allowCustomValue}
        allValue={allValue}
        onMultiChange={onMultiChange}
        onIncludeAllChange={onIncludeAllChange}
        onAllValueChange={onAllValueChange}
        onAllowCustomValueChange={onAllowCustomValueChange}
      />
    </>
  );
}
