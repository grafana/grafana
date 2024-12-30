import { FormEvent, useCallback } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, MetricFindValue, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable } from '@grafana/scenes';

import { AdHocVariableForm } from '../components/AdHocVariableForm';

interface AdHocFiltersVariableEditorProps {
  variable: AdHocFiltersVariable;
  onRunQuery: (variable: AdHocFiltersVariable) => void;
}

export function AdHocFiltersVariableEditor(props: AdHocFiltersVariableEditorProps) {
  const { variable } = props;
  const { datasource: datasourceRef, defaultKeys, allowCustomValue, collapseFilters } = variable.useState();

  const { value: datasourceSettings } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [datasourceRef]);

  const message = datasourceSettings?.getTagKeys
    ? 'Ad hoc filters are applied automatically to all queries that target this data source'
    : 'This data source does not support ad hoc filters yet.';

  const onDataSourceChange = useCallback(
    (ds: DataSourceInstanceSettings) => {
      const dsRef = getDataSourceRef(ds);

      variable.setState({
        datasource: dsRef,
        supportsMultiValueOperators: ds.meta.multiValueFilterOperators,
      });
    },
    [variable]
  );

  const onDefaultKeysChange = useCallback(
    (defaultKeys?: MetricFindValue[]) => {
      variable.setState({
        defaultKeys,
      });
    },
    [variable]
  );

  const onAllowCustomValueChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ allowCustomValue: event.currentTarget.checked });
    },
    [variable]
  );

  const onCollapseFiltersValueChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      variable.setState({ collapseFilters: event.currentTarget.checked });
    },
    [variable]
  );

  return (
    <AdHocVariableForm
      datasource={datasourceRef ?? undefined}
      infoText={message}
      allowCustomValue={allowCustomValue}
      onDataSourceChange={onDataSourceChange}
      defaultKeys={defaultKeys}
      onDefaultKeysChange={onDefaultKeysChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
      collapseFilters={collapseFilters}
      onCollapseFiltersValueChange={onCollapseFiltersValueChange}
    />
  );
}
