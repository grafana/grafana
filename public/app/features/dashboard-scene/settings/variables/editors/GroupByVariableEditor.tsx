import { noop } from 'lodash';
import { FormEvent } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, MetricFindValue, getDataSourceRef } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { GroupByVariable, SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { GroupByVariableForm } from '../components/GroupByVariableForm';

interface GroupByVariableEditorProps {
  variable: GroupByVariable;
  onRunQuery: () => void;
  inline?: boolean;
}

export function GroupByVariableEditor(props: GroupByVariableEditorProps) {
  const { variable, onRunQuery, inline } = props;
  const { datasource: datasourceRef, defaultOptions, allowCustomValue = true, defaultValue } = variable.useState();

  const { value: datasource } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [variable.state]);

  const { value: tagKeyOptions = [] } = useAsync(async () => {
    if (!datasource?.getTagKeys) {
      return [];
    }
    const result = await datasource.getTagKeys({ filters: [] });
    const keys = Array.isArray(result) ? result : (result.data ?? []);
    return keys.map((k) => ({ label: k.text || String(k.value), value: String(k.value) }));
  }, [datasource]);

  const supported = datasource?.getTagKeys !== undefined;
  const message = supported
    ? 'Group by dimensions are applied automatically to all queries that target this data source'
    : 'This data source does not support group by variable yet.';

  const onDataSourceChange = async (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    variable.setState({ datasource: dsRef });
    onRunQuery();
  };

  const onDefaultOptionsChange = async (defaultOptions?: MetricFindValue[]) => {
    variable.setState({ defaultOptions });
    onRunQuery();
  };

  const onDefaultValueChange = (values: string[]) => {
    if (values.length === 0) {
      variable.setState({ defaultValue: undefined });
    } else {
      variable.setState({
        defaultValue: {
          value: values,
          text: values,
        },
      });
    }
  };

  const defaultValueStrings: string[] = defaultValue
    ? Array.isArray(defaultValue.value)
      ? defaultValue.value.map(String)
      : [String(defaultValue.value)]
    : [];

  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };

  return (
    <GroupByVariableForm
      defaultOptions={defaultOptions}
      datasource={datasourceRef ?? undefined}
      infoText={datasourceRef ? message : undefined}
      onDataSourceChange={onDataSourceChange}
      onDefaultOptionsChange={onDefaultOptionsChange}
      defaultValue={defaultValueStrings}
      defaultValueOptions={tagKeyOptions}
      onDefaultValueChange={onDefaultValueChange}
      allowCustomValue={allowCustomValue}
      onAllowCustomValueChange={onAllowCustomValueChange}
      inline={inline}
      datasourceSupported={supported}
    />
  );
}

export function getGroupByVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof GroupByVariable)) {
    console.warn('getAdHocFilterOptions: variable is not an AdHocFiltersVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <GroupByVariableEditor variable={variable} onRunQuery={noop} inline={true} />,
    }),
  ];
}
