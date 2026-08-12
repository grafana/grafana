import { noop } from 'lodash';
import { type FormEvent } from 'react';
import { useAsync } from 'react-use';

import {
  type DataSourceInstanceSettings,
  type MetricFindValue,
  type SelectableValue,
  getDataSourceRef,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { GroupByVariable, type SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { GroupByVariableForm } from '../components/GroupByVariableForm';
import { undoableVariableEdit } from '../undoableVariableEdit';

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

  const { value: groupByKeys = [] } = useAsync(async () => {
    if (!datasource?.getGroupByKeys) {
      return [];
    }
    const result = await datasource.getGroupByKeys({ filters: [] });
    const keys = Array.isArray(result) ? result : (result.data ?? []);
    return keys.map((k) => ({ label: k.text || String(k.value), value: String(k.value) }));
  }, [datasource]);

  const message = datasource?.getGroupByKeys
    ? 'Group by dimensions are applied automatically to all queries that target this data source'
    : 'This data source does not support group by variable yet.';

  const onDataSourceChange = async (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);
    const prevDsRef = variable.state.datasource;

    undoableVariableEdit(inline, {
      description: t('dashboard.edit-actions.variable-datasource', 'Change variable data source'),
      source: variable,
      perform: () => {
        variable.setState({ datasource: dsRef });
        onRunQuery();
      },
      undo: () => {
        variable.setState({ datasource: prevDsRef });
        onRunQuery();
      },
    });
  };

  const onDefaultOptionsChange = async (defaultOptions?: MetricFindValue[]) => {
    const prevDefaultOptions = variable.state.defaultOptions;

    undoableVariableEdit(inline, {
      description: t('dashboard.edit-actions.variable-default-options', 'Change variable default options'),
      source: variable,
      perform: () => {
        variable.setState({ defaultOptions });
        onRunQuery();
      },
      undo: () => {
        variable.setState({ defaultOptions: prevDefaultOptions });
        onRunQuery();
      },
    });
  };

  const onDefaultValueChange = (options: Array<SelectableValue<string>>) => {
    if (options.length === 0) {
      variable.setState({
        defaultValue: undefined,
        restorable: false,
      });
      variable.changeValueTo([], []);
    } else {
      const value = options.map((opt) => opt.value!);
      const text = options.map((opt) => opt.label ?? opt.value!);
      variable.setState({
        defaultValue: { value, text },
        restorable: false,
      });
      variable.changeValueTo(value, text);
    }
    onRunQuery();
  };

  const defaultValueSelection: Array<SelectableValue<string>> = defaultValue
    ? Array.isArray(defaultValue.value)
      ? defaultValue.value.map((v, i) => {
          const texts = defaultValue.text;
          const label = Array.isArray(texts) ? String(texts[i]) : String(texts);
          return { value: String(v), label };
        })
      : [{ value: String(defaultValue.value), label: String(defaultValue.text ?? defaultValue.value) }]
    : [];

  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    const newAllowCustomValue = event.currentTarget.checked;
    const prevAllowCustomValue = variable.state.allowCustomValue;

    undoableVariableEdit(inline, {
      description: t('dashboard.edit-actions.variable-allow-custom-value', 'Change variable allow custom value'),
      source: variable,
      perform: () => variable.setState({ allowCustomValue: newAllowCustomValue }),
      undo: () => variable.setState({ allowCustomValue: prevAllowCustomValue }),
    });
  };

  return (
    <GroupByVariableForm
      defaultOptions={defaultOptions}
      datasource={datasourceRef ?? undefined}
      infoText={datasourceRef ? message : undefined}
      onDataSourceChange={onDataSourceChange}
      onDefaultOptionsChange={onDefaultOptionsChange}
      defaultValue={defaultValueSelection}
      defaultValueOptions={groupByKeys}
      onDefaultValueChange={onDefaultValueChange}
      allowCustomValue={allowCustomValue}
      onAllowCustomValueChange={onAllowCustomValueChange}
      inline={inline}
      datasourceSupported={datasource?.getGroupByKeys ? true : false}
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
