import React from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, DataSourceRef, MetricFindValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { GroupByVariable } from '@grafana/scenes';

import { GroupByVariableForm } from '../components/GroupByVariableForm';

interface GroupByVariableEditorProps {
  variable: GroupByVariable;
  onRunQuery: () => void;
}

export function GroupByVariableEditor(props: GroupByVariableEditorProps) {
  const { variable, onRunQuery } = props;
  const { datasource: datasourceRef, defaultOptions } = variable.useState();

  const { value: datasource } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [variable.state]);

  const message = datasource?.getTagKeys
    ? 'Group by dimensions are applied automatically to all queries that target this data source'
    : 'This data source does not support group by variable yet.';

  const onDataSourceChange = async (ds: DataSourceInstanceSettings) => {
    const dsRef: DataSourceRef = {
      uid: ds.uid,
      type: ds.type,
    };

    variable.setState({ datasource: dsRef });
    onRunQuery();
  };

  const onDefaultOptionsChange = async (defaultOptions?: MetricFindValue[]) => {
    variable.setState({ defaultOptions });
    onRunQuery();
  };

  return (
    <GroupByVariableForm
      defaultOptions={defaultOptions}
      datasource={datasourceRef ?? undefined}
      infoText={datasourceRef ? message : undefined}
      onDataSourceChange={onDataSourceChange}
      onDefaultOptionsChange={onDefaultOptionsChange}
    />
  );
}
