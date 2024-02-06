import React from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { AdHocFilterSet, AdHocFiltersVariable } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { AdHocVariableForm } from '../components/AdHocVariableForm';

interface AdHocFiltersVariableEditorProps {
  variable: AdHocFiltersVariable;
  onRunQuery: (variable: AdHocFiltersVariable) => void;
}

export function AdHocFiltersVariableEditor(props: AdHocFiltersVariableEditorProps) {
  const { variable } = props;
  const { set: filterSet } = variable.useState();
  const { datasource: datasourceRef } = filterSet.useState();

  const { value: datasource } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [variable.state]);

  const message = datasource?.getTagKeys
    ? 'Ad hoc filters are applied automatically to all queries that target this data source'
    : 'This data source does not support ad hoc filters yet.';

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef: DataSourceRef = {
      uid: ds.uid,
      type: ds.type,
    };

    filterSet.setState({ datasource: dsRef });
  };

  return <AdHocVariableForm datasource={datasource} infoText={message} onDataSourceChange={onDataSourceChange} />;
}
