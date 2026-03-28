import { noop } from 'lodash';
import { FormEvent, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings, MetricFindValue, getDataSourceRef } from '@grafana/data';
import { t } from '@grafana/i18n';
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
  const { datasource: datasourceRef, defaultKeys, allowCustomValue, enableGroupBy } = variable.useState();

  const [wip, setWip] = useState<AdHocFilterWithLabels | undefined>(undefined);
  const [originalFilters, setOriginalFilters] = useState(() => variable.getOriginalFilters());

  const { dashboardOriginalFilters, nonDashboardOriginalFilters } = useMemo(() => {
    const dashboardOriginalFilters: AdHocFilterWithLabels[] = [];
    const nonDashboardOriginalFilters: AdHocFilterWithLabels[] = [];

    for (const f of originalFilters) {
      (f.origin === 'dashboard' ? dashboardOriginalFilters : nonDashboardOriginalFilters).push(f);
    }
    return { dashboardOriginalFilters, nonDashboardOriginalFilters };
  }, [originalFilters]);

  const originFiltersController = useMemo(() => {
    if (!config.featureToggles.adHocFilterDefaultValues) {
      return undefined;
    }

    return new AdHocOriginFiltersController(
      dashboardOriginalFilters,
      (filters) => {
        const allFilters = [...nonDashboardOriginalFilters, ...filters];
        variable.setOriginalFilters(allFilters);
        variable.setState({ originFilters: allFilters });
        setOriginalFilters(allFilters);
      },
      wip,
      setWip,
      allowCustomValue,
      (currentKey) => variable._getKeys(currentKey),
      (filter) => variable._getValuesFor(filter),
      () => variable._getOperators()
    );
  }, [variable, dashboardOriginalFilters, nonDashboardOriginalFilters, wip, allowCustomValue]);

  const { value: datasourceSettings } = useAsync(async () => {
    return await getDataSourceSrv().get(datasourceRef);
  }, [datasourceRef]);

  const message = datasourceSettings?.getTagKeys
    ? t(
        'dashboard-scene.ad-hoc-filters-variable-editor.message-supported',
        'Filters are applied automatically to all queries that target this data source'
      )
    : t(
        'dashboard-scene.ad-hoc-filters-variable-editor.message-not-supported',
        'This data source does not support filters.'
      );

  const onDataSourceChange = async (ds: DataSourceInstanceSettings) => {
    const dsRef = getDataSourceRef(ds);
    const dsInstance = await getDataSourceSrv().get(dsRef);

    variable.setState({
      datasource: dsRef,
      supportsMultiValueOperators: ds.meta.multiValueFilterOperators,
      ...(config.featureToggles.dashboardUnifiedDrilldownControls && {
        enableGroupBy: !!dsInstance?.getGroupByKeys,
      }),
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

  const onEnableGroupByChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ enableGroupBy: event.currentTarget.checked });
  };

  return (
    <AdHocVariableForm
      datasource={datasourceRef ?? undefined}
      infoText={message}
      allowCustomValue={allowCustomValue}
      enableGroupBy={enableGroupBy}
      onDataSourceChange={onDataSourceChange}
      defaultKeys={defaultKeys}
      onDefaultKeysChange={onDefaultKeysChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
      onEnableGroupByChange={onEnableGroupByChange}
      originFiltersController={originFiltersController}
      inline={props.inline}
      datasourceSupported={datasourceSettings?.getTagKeys ? true : false}
      datasourceSupportsGroupBy={!!datasourceSettings?.getGroupByKeys}
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
