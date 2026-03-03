import { noop } from 'lodash';
import { FormEvent, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, MetricFindValue, getDataSourceRef } from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, AdHocFilterWithLabels, SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { AdHocOriginFiltersController } from '../components/AdHocOriginFiltersController';
import { AdHocVariableForm } from '../components/AdHocVariableForm';

interface AdHocFiltersVariableEditorProps {
  variable: AdHocFiltersVariable;
  onRunQuery: (variable: AdHocFiltersVariable) => void;
  inline?: boolean;
}

export function AdHocFiltersVariableEditor(props: AdHocFiltersVariableEditorProps) {
  const { variable } = props;
  const { datasource: datasourceRef, defaultKeys, allowCustomValue, originFilters } = variable.useState();

  const [wip, setWip] = useState<AdHocFilterWithLabels | undefined>(undefined);

  const originFiltersController = useMemo(() => {
    if (!config.featureToggles.adHocFilterDefaultValues) {
      return undefined;
    }
    return new AdHocOriginFiltersController(
      originFilters ?? [],
      // TODO: do I need to filter out dashboard origin only? Or other origins wont live here?
      (filters) => variable.setState({ originFilters: filters }),
      wip,
      setWip,
      allowCustomValue,
      (currentKey) => variable._getKeys(currentKey),
      (filter) => variable._getValuesFor(filter),
      () => variable._getOperators()
    );
  }, [variable, originFilters, wip, allowCustomValue]);

  const { value: datasourceSettings } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [datasourceRef]);

  const message = datasourceSettings?.getTagKeys
    ? 'Ad hoc filters are applied automatically to all queries that target this data source'
    : 'This data source does not support ad hoc filters.';

  const onDataSourceChange = (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);

    variable.setState({
      datasource: dsRef,
      supportsMultiValueOperators: ds.meta.multiValueFilterOperators,
    });
  };

  const onDefaultKeysChange = (defaultKeys?: MetricFindValue[]) => {
    variable.setState({
      defaultKeys,
    });
  };

  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };

  return (
    <AdHocVariableForm
      datasource={datasourceRef ?? undefined}
      infoText={message}
      allowCustomValue={allowCustomValue}
      onDataSourceChange={onDataSourceChange}
      defaultKeys={defaultKeys}
      onDefaultKeysChange={onDefaultKeysChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
      originFiltersController={originFiltersController}
      inline={props.inline}
      datasourceSupported={datasourceSettings?.getTagKeys ? true : false}
    />
  );
}

export function getAdHocFilterOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof AdHocFiltersVariable)) {
    console.warn('getAdHocFilterOptions: variable is not an AdHocFiltersVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <AdHocFiltersVariableEditor variable={variable} onRunQuery={noop} inline={true} />,
    }),
  ];
}
