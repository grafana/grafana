import { noop } from 'lodash';
import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import type { DataSourceInstanceSettings, MetricFindValue, SelectableValue } from '@grafana/data/types';
import { getDataSourceRef } from '@grafana/data/utils';
import { t } from '@grafana/i18n';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, type AdHocFilterWithLabels, type SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { AdHocOriginFiltersController } from '../components/AdHocOriginFiltersController';
import { AdHocVariableForm } from '../components/AdHocVariableForm';

interface AdHocFiltersVariableEditorProps {
  variable: AdHocFiltersVariable;
  onRunQuery: (variable: AdHocFiltersVariable) => void;
  inline?: boolean;
}

const ORIGIN_DASHBOARD = 'dashboard';

function isOriginDashboard(f: AdHocFilterWithLabels) {
  return f.origin === ORIGIN_DASHBOARD;
}

function isGroupByOriginFilter(f: AdHocFilterWithLabels) {
  return isOriginDashboard(f) && f.operator === 'groupBy';
}

export function AdHocFiltersVariableEditor(props: AdHocFiltersVariableEditorProps) {
  const { variable } = props;
  const { datasource: datasourceRef, defaultKeys, allowCustomValue, enableGroupBy } = variable.useState();

  const [wip, setWip] = useState<AdHocFilterWithLabels | undefined>(undefined);

  const [originalFilters, setOriginalFilters] = useState<AdHocFilterWithLabels[]>(() => variable.getOriginalFilters());

  const adhocOriginFilters = useMemo(
    () => originalFilters.filter((f) => isOriginDashboard(f) && !isGroupByOriginFilter(f)),
    [originalFilters]
  );

  const groupByOriginFilters = useMemo(() => originalFilters.filter(isGroupByOriginFilter), [originalFilters]);

  const groupByEnabled = config.featureToggles.dashboardUnifiedDrilldownControls && enableGroupBy;

  const updateOriginalFilters = useCallback(
    (filters: AdHocFilterWithLabels[]) => {
      setOriginalFilters(filters);
      variable.setOriginalFilters(filters);
      variable.setState({ originFilters: filters });
    },
    [variable]
  );

  const originFiltersController = useMemo(() => {
    if (!config.featureToggles.adHocFilterDefaultValues && !config.featureToggles.dashboardUnifiedDrilldownControls) {
      return undefined;
    }

    return new AdHocOriginFiltersController(
      adhocOriginFilters,
      (filters) => {
        const keep = originalFilters.filter((f) => !isOriginDashboard(f) || isGroupByOriginFilter(f));
        updateOriginalFilters([...keep, ...filters]);
      },
      wip,
      setWip,
      allowCustomValue,
      (currentKey) => variable._getKeys(currentKey),
      (filter) => variable._getValuesFor(filter),
      () => variable._getOperators()
    );
  }, [variable, adhocOriginFilters, originalFilters, wip, allowCustomValue, updateOriginalFilters]);

  const defaultGroupByValues: Array<SelectableValue<string>> = useMemo(
    () => groupByOriginFilters.map((f) => ({ value: f.key, label: f.keyLabel || f.key })),
    [groupByOriginFilters]
  );

  const onDefaultGroupByChange = (items: Array<SelectableValue<string>>) => {
    const groupByFilters: AdHocFilterWithLabels[] = items
      .filter((item) => item.value != null)
      .map((item) => ({
        key: item.value!,
        keyLabel: item.label || item.value!,
        operator: 'groupBy',
        value: '',
        origin: ORIGIN_DASHBOARD,
      }));
    const keep = originalFilters.filter((f) => !isGroupByOriginFilter(f));
    updateOriginalFilters([...keep, ...groupByFilters]);
  };

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

  const { value: groupByKeyOptions = [] } = useAsync(async () => {
    if (!groupByEnabled) {
      return [];
    }
    return variable._getGroupByKeys(null);
  }, [variable, groupByEnabled]);

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
      defaultGroupByValues={groupByEnabled ? defaultGroupByValues : undefined}
      defaultGroupByOptions={groupByEnabled ? groupByKeyOptions : undefined}
      onDefaultGroupByChange={groupByEnabled ? onDefaultGroupByChange : undefined}
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
