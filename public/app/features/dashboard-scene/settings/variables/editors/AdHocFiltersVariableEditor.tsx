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
  const { datasource: datasourceRef, defaultKeys } = variable.useState();

  const { value: datasourceSettings } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [datasourceRef]);

  const message = datasourceSettings?.getTagKeys
    ? 'Ad hoc filters are applied automatically to all queries that target this data source'
    : 'This data source does not support ad hoc filters yet.';

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    variable.setState({
      datasource: dsRef,
    });
  };

  const onDefaultKeysChange = (defaultKeys?: MetricFindValue[]) => {
    variable.setState({
      defaultKeys,
    });
  };

  return (
    <AdHocVariableForm
      datasource={datasourceRef ?? undefined}
      infoText={message}
      onDataSourceChange={onDataSourceChange}
      defaultKeys={defaultKeys}
      onDefaultKeysChange={onDefaultKeysChange}
    />
  );
}
