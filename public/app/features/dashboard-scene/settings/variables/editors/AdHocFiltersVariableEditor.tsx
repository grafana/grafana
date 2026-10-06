import { isEqual, noop, omit } from 'lodash';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsync } from 'react-use';

import {
  type DataSourceInstanceSettings,
  type MetricFindValue,
  type SelectableValue,
  getDataSourceRef,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { AdHocFiltersVariable, type AdHocFilterWithLabels, type SceneVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { undoableVariableEdit } from '../../../actions/variable/undoableVariableEdit';
import { type DashboardActionMeta } from '../../../sidebar/events';
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
  const { variable, inline } = props;
  const {
    datasource: datasourceRef,
    defaultKeys,
    allowCustomValue,
    enableGroupBy,
    originFilters,
  } = variable.useState();

  const [wip, setWip] = useState<AdHocFilterWithLabels | undefined>(undefined);

  const [originalFilters, setOriginalFilters] = useState<AdHocFilterWithLabels[]>(() => variable.getOriginalFilters());
  const originFiltersSetByEditor = useRef(originFilters);

  // Origin filters can also be replaced outside of the editor (e.g. undo/redo), re-read the original filters then
  useEffect(() => {
    if (originFilters !== originFiltersSetByEditor.current) {
      originFiltersSetByEditor.current = originFilters;
      setOriginalFilters(variable.getOriginalFilters());
    }
  }, [variable, originFilters]);

  const adhocOriginFilters = useMemo(
    () => originalFilters.filter((f) => isOriginDashboard(f) && !isGroupByOriginFilter(f)),
    [originalFilters]
  );

  const groupByOriginFilters = useMemo(() => originalFilters.filter(isGroupByOriginFilter), [originalFilters]);

  const groupByEnabled = Boolean(
    config.featureToggles.dashboardUnifiedDrilldownControls && enableGroupBy && datasourceRef
  );

  const updateOriginalFilters = useCallback(
    (filters: AdHocFilterWithLabels[], description: string, meta: DashboardActionMeta) => {
      const oldOriginalFilters = variable.getOriginalFilters();
      const oldOriginFilters = variable.state.originFilters;

      setOriginalFilters(filters);
      originFiltersSetByEditor.current = filters;

      // Moving editing between pills only toggles forceEdit, which is not a change worth an undo entry
      const changed = !isEqual(withoutForceEdit(oldOriginFilters), withoutForceEdit(filters));

      undoableVariableEdit(inline && changed, {
        meta,
        source: variable,
        description,
        perform: () => {
          variable.setOriginalFilters(filters);
          variable.setState({ originFilters: filters });
        },
        undo: () => {
          variable.setOriginalFilters(oldOriginalFilters);
          variable.setState({ originFilters: oldOriginFilters });
        },
      });
    },
    [variable, inline]
  );

  const originFiltersController = useMemo(() => {
    if (!config.featureToggles.dashboardUnifiedDrilldownControls) {
      return undefined;
    }

    return new AdHocOriginFiltersController(
      adhocOriginFilters,
      (filters) => {
        const keep = originalFilters.filter((f) => !isOriginDashboard(f) || isGroupByOriginFilter(f));
        updateOriginalFilters(
          [...keep, ...filters],
          t('dashboard.edit-actions.variable-adhoc-default-filters', 'Change variable default filters'),
          { actionId: 'variable.changeDefaultFilters' }
        );
        reportInteraction('grafana_unified_drilldown_default_filters_changed', { count: filters.length });
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
    updateOriginalFilters(
      [...keep, ...groupByFilters],
      t('dashboard.edit-actions.variable-adhoc-default-group-by', 'Change variable default group by'),
      { actionId: 'variable.changeDefaultGroupBy' }
    );
    reportInteraction('grafana_unified_drilldown_default_groupby_changed', { count: groupByFilters.length });
  };

  const { value: datasourceSettings } = useAsync(async () => {
    return await getDataSourceInstance(datasourceRef);
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
    const dsInstance = await getDataSourceInstance(dsRef);
    const { datasource: oldDatasource, supportsMultiValueOperators, enableGroupBy: oldEnableGroupBy } = variable.state;
    const updateEnableGroupBy = config.featureToggles.dashboardUnifiedDrilldownControls;

    undoableVariableEdit(inline, {
      meta: { actionId: 'variable.changeDataSource', scope: 'adhoc' },
      source: variable,
      description: t('dashboard.edit-actions.variable-datasource', 'Change variable data source'),
      perform: () => {
        variable.setState({
          datasource: dsRef,
          supportsMultiValueOperators: ds.meta.multiValueFilterOperators,
          ...(updateEnableGroupBy && {
            enableGroupBy: !!dsInstance?.getGroupByKeys,
          }),
        });
      },
      undo: () => {
        variable.setState({
          datasource: oldDatasource,
          supportsMultiValueOperators,
          ...(updateEnableGroupBy && {
            enableGroupBy: oldEnableGroupBy,
          }),
        });
      },
    });
  };

  const onDefaultKeysChange = (defaultKeys?: MetricFindValue[]) => {
    const oldDefaultKeys = variable.state.defaultKeys;

    undoableVariableEdit(inline && !isEqual(oldDefaultKeys, defaultKeys), {
      meta: { actionId: 'variable.changeDefaultKeys' },
      source: variable,
      description: t('dashboard.edit-actions.variable-adhoc-default-keys', 'Change variable static keys'),
      perform: () => variable.setState({ defaultKeys }),
      undo: () => variable.setState({ defaultKeys: oldDefaultKeys }),
    });
  };

  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    const newAllowCustomValue = event.currentTarget.checked;
    const oldAllowCustomValue = variable.state.allowCustomValue;

    undoableVariableEdit(inline, {
      meta: { actionId: 'variable.changeAllowCustomValue', scope: 'adhoc' },
      source: variable,
      description: t('dashboard.edit-actions.variable-allow-custom-value', 'Change variable allow custom values'),
      perform: () => variable.setState({ allowCustomValue: newAllowCustomValue }),
      undo: () => variable.setState({ allowCustomValue: oldAllowCustomValue }),
    });
  };

  const onEnableGroupByChange = (event: FormEvent<HTMLInputElement>) => {
    const enabled = event.currentTarget.checked;
    const oldEnableGroupBy = variable.state.enableGroupBy;

    undoableVariableEdit(inline, {
      meta: { actionId: 'variable.changeEnableGroupBy' },
      source: variable,
      description: t('dashboard.edit-actions.variable-adhoc-enable-group-by', 'Change variable group by option'),
      perform: () => variable.setState({ enableGroupBy: enabled }),
      undo: () => variable.setState({ enableGroupBy: oldEnableGroupBy }),
    });
    reportInteraction('grafana_unified_drilldown_enable_groupby_toggled', { enabled });
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
      enableGroupBy={enableGroupBy ?? !datasourceRef}
      onDataSourceChange={onDataSourceChange}
      defaultKeys={defaultKeys}
      onDefaultKeysChange={onDefaultKeysChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
      onEnableGroupByChange={onEnableGroupByChange}
      originFiltersController={originFiltersController}
      defaultGroupByValues={groupByEnabled ? defaultGroupByValues : undefined}
      defaultGroupByOptions={groupByEnabled ? groupByKeyOptions : undefined}
      onDefaultGroupByChange={groupByEnabled ? onDefaultGroupByChange : undefined}
      inline={inline}
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

function withoutForceEdit(filters: AdHocFilterWithLabels[] | undefined) {
  return filters?.map((filter) => omit(filter, 'forceEdit'));
}
