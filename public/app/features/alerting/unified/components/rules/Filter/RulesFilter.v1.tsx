import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Field, Icon, Input, Label, RadioButtonGroup, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { contextSrv } from 'app/core/core';
import { Trans } from 'app/core/internationalization';
import { ContactPointSelector } from 'app/features/alerting/unified/components/notification-policies/ContactPointSelector';
import { AccessControlAction } from 'app/types';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import {
  LogMessages,
  logInfo,
  trackRulesSearchComponentInteraction,
  trackRulesSearchInputInteraction,
} from '../../../Analytics';
import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { useAlertingHomePageExtensions } from '../../../plugins/useAlertingHomePageExtensions';
import { RuleHealth } from '../../../search/rulesSearchParser';
import { AlertmanagerProvider } from '../../../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { alertStateToReadable } from '../../../utils/rules';
import { PopupCard } from '../../HoverCard';
import { MultipleDataSourcePicker } from '../MultipleDataSourcePicker';

import { RulesViewModeSelector } from './RulesViewModeSelector';

const RuleTypeOptions: SelectableValue[] = [
  { label: 'Alert ', value: PromRuleType.Alerting },
  { label: 'Recording ', value: PromRuleType.Recording },
];

const RuleHealthOptions: SelectableValue[] = [
  { label: 'Ok', value: RuleHealth.Ok },
  { label: 'No Data', value: RuleHealth.NoData },
  { label: 'Error', value: RuleHealth.Error },
];

interface RulesFilerProps {
  onClear?: () => void;
}

const RuleStateOptions = Object.entries(PromAlertingRuleState).map(([key, value]) => ({
  label: alertStateToReadable(value),
  value,
}));

const RulesFilter = ({ onClear = () => undefined }: RulesFilerProps) => {
  const styles = useStyles2(getStyles);
  const { pluginsFilterEnabled } = usePluginsFilterStatus();
  const { filterState, hasActiveFilters, searchQuery, setSearchQuery, updateFilters } = useRulesFilter();

  // This key is used to force a rerender on the inputs when the filters are cleared
  const [filterKey, setFilterKey] = useState<number>(Math.floor(Math.random() * 100));
  const dataSourceKey = `dataSource-${filterKey}`;
  const queryStringKey = `queryString-${filterKey}`;

  const searchQueryRef = useRef<HTMLInputElement | null>(null);
  const { handleSubmit, register, setValue } = useForm<{ searchQuery: string }>({
    defaultValues: { searchQuery },
  });
  const { ref, ...rest } = register('searchQuery');

  useEffect(() => {
    setValue('searchQuery', searchQuery);
  }, [searchQuery, setValue]);

  const handleDataSourceChange = (dataSourceValue: DataSourceInstanceSettings, action: 'add' | 'remove') => {
    const dataSourceNames =
      action === 'add'
        ? [...filterState.dataSourceNames].concat([dataSourceValue.name])
        : filterState.dataSourceNames.filter((name) => name !== dataSourceValue.name);

    updateFilters({
      ...filterState,
      dataSourceNames,
    });

    setFilterKey((key) => key + 1);
    trackRulesSearchComponentInteraction('dataSourceNames');
  };

  const handleDashboardChange = (dashboardUid: string | undefined) => {
    updateFilters({ ...filterState, dashboardUid });
    trackRulesSearchComponentInteraction('dashboardUid');
  };

  const clearDataSource = () => {
    updateFilters({ ...filterState, dataSourceNames: [] });
    setFilterKey((key) => key + 1);
  };

  const handleAlertStateChange = (value: PromAlertingRuleState) => {
    logInfo(LogMessages.clickingAlertStateFilters);
    updateFilters({ ...filterState, ruleState: value });
    trackRulesSearchComponentInteraction('ruleState');
  };

  const handleRuleTypeChange = (ruleType: PromRuleType) => {
    updateFilters({ ...filterState, ruleType });
    trackRulesSearchComponentInteraction('ruleType');
  };

  const handleRuleHealthChange = (ruleHealth: RuleHealth) => {
    updateFilters({ ...filterState, ruleHealth });
    trackRulesSearchComponentInteraction('ruleHealth');
  };

  const handleClearFiltersClick = () => {
    setSearchQuery(undefined);
    onClear();

    setTimeout(() => setFilterKey(filterKey + 1), 100);
  };

  const handleContactPointChange = (contactPoint: string) => {
    updateFilters({ ...filterState, contactPoint });
    trackRulesSearchComponentInteraction('contactPoint');
  };

  const canRenderContactPointSelector =
    (contextSrv.hasPermission(AccessControlAction.AlertingReceiversRead) &&
      config.featureToggles.alertingSimplifiedRouting) ??
    false;
  const searchIcon = <Icon name={'search'} />;

  return (
    <Stack direction="column" gap={0}>
      <Stack direction="row" gap={1} wrap="wrap">
        <Field
          className={styles.dsPickerContainer}
          label={
            <Label htmlFor="data-source-picker">
              <Stack gap={0.5} alignItems="center">
                <span>Search by data sources</span>
                <Tooltip
                  content={
                    <div>
                      <p>
                        Data sources containing configured alert rules are Mimir or Loki data sources where alert rules
                        are stored and evaluated in the data source itself.
                      </p>
                      <p>
                        In these data sources, you can select Manage alerts via Alerting UI to be able to manage these
                        alert rules in the Grafana UI as well as in the data source where they were configured.
                      </p>
                    </div>
                  }
                >
                  <Icon
                    id="data-source-picker-inline-help"
                    name="info-circle"
                    size="sm"
                    title="Search by data sources help"
                  />
                </Tooltip>
              </Stack>
            </Label>
          }
        >
          <MultipleDataSourcePicker
            key={dataSourceKey}
            alerting
            noDefault
            placeholder="All data sources"
            current={filterState.dataSourceNames}
            onChange={handleDataSourceChange}
            onClear={clearDataSource}
          />
        </Field>

        <Field
          className={styles.dashboardPickerContainer}
          label={<Label htmlFor="filters-dashboard-picker">Dashboard</Label>}
        >
          {/* The key prop is to clear the picker value */}
          {/* DashboardPicker doesn't do that itself when value is undefined */}
          <DashboardPicker
            inputId="filters-dashboard-picker"
            key={filterState.dashboardUid ? 'dashboard-defined' : 'dashboard-not-defined'}
            value={filterState.dashboardUid}
            onChange={(value) => handleDashboardChange(value?.uid)}
            isClearable
            cacheOptions
          />
        </Field>

        <div>
          <Label>State</Label>
          <RadioButtonGroup
            options={RuleStateOptions}
            value={filterState.ruleState}
            onChange={handleAlertStateChange}
          />
        </div>
        <div>
          <Label>Rule type</Label>
          <RadioButtonGroup options={RuleTypeOptions} value={filterState.ruleType} onChange={handleRuleTypeChange} />
        </div>
        <div>
          <Label>Health</Label>
          <RadioButtonGroup
            options={RuleHealthOptions}
            value={filterState.ruleHealth}
            onChange={handleRuleHealthChange}
          />
        </div>
        {canRenderContactPointSelector && (
          <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
            <Stack direction="column" gap={0}>
              <Field
                label={
                  <Label htmlFor="contactPointFilter">
                    <Trans i18nKey="alerting.contactPointFilter.label">Contact point</Trans>
                  </Label>
                }
              >
                <ContactPointSelector
                  selectedContactPointName={filterState.contactPoint}
                  selectProps={{
                    inputId: 'contactPointFilter',
                    width: 40,
                    onChange: (selectValue) => {
                      handleContactPointChange(selectValue?.value?.name!);
                    },
                    isClearable: true,
                  }}
                />
              </Field>
            </Stack>
          </AlertmanagerProvider>
        )}
        {pluginsFilterEnabled && (
          <div>
            <Label>Plugin rules</Label>
            <RadioButtonGroup<'hide'>
              options={[
                { label: 'Show', value: undefined },
                { label: 'Hide', value: 'hide' },
              ]}
              value={filterState.plugins}
              onChange={(value) => updateFilters({ ...filterState, plugins: value })}
            />
          </div>
        )}
      </Stack>

      <Stack direction="column" gap={0}>
        <Stack direction="row" gap={1}>
          <form
            className={styles.searchInput}
            onSubmit={handleSubmit((data) => {
              setSearchQuery(data.searchQuery);
              searchQueryRef.current?.blur();
              trackRulesSearchInputInteraction({ oldQuery: searchQuery, newQuery: data.searchQuery });
            })}
          >
            <Field
              label={
                <Label htmlFor="rulesSearchInput">
                  <Stack gap={0.5} alignItems="center">
                    <span>Search</span>
                    <PopupCard content={<SearchQueryHelp />}>
                      <Icon name="info-circle" size="sm" tabIndex={0} title="Search help" />
                    </PopupCard>
                  </Stack>
                </Label>
              }
            >
              <Input
                id="rulesSearchInput"
                key={queryStringKey}
                prefix={searchIcon}
                ref={(e) => {
                  ref(e);
                  searchQueryRef.current = e;
                }}
                {...rest}
                placeholder="Search"
                data-testid="search-query-input"
              />
            </Field>
            <input type="submit" hidden />
          </form>
          <div>
            <Label>View as</Label>
            <RulesViewModeSelector />
          </div>
        </Stack>
        {hasActiveFilters && (
          <div>
            <Button fullWidth={false} icon="times" variant="secondary" onClick={handleClearFiltersClick}>
              Clear filters
            </Button>
          </div>
        )}
      </Stack>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    dsPickerContainer: css({
      width: theme.spacing(60),
      flexGrow: 0,
      margin: 0,
    }),
    dashboardPickerContainer: css({
      minWidth: theme.spacing(50),
    }),
    searchInput: css({
      flex: 1,
      margin: 0,
    }),
  };
};

function SearchQueryHelp() {
  const styles = useStyles2(helpStyles);

  return (
    <div>
      <div>Search syntax allows to query alert rules by the parameters defined below.</div>
      <hr />
      <div className={styles.grid}>
        <div>Filter type</div>
        <div>Expression</div>
        <HelpRow title="Datasources" expr="datasource:mimir datasource:prometheus" />
        <HelpRow title="Folder/Namespace" expr="namespace:global" />
        <HelpRow title="Group" expr="group:cpu-usage" />
        <HelpRow title="Rule" expr='rule:"cpu 80%"' />
        <HelpRow title="Labels" expr="label:team=A label:cluster=a1" />
        <HelpRow title="State" expr="state:firing|normal|pending" />
        <HelpRow title="Type" expr="type:alerting|recording" />
        <HelpRow title="Health" expr="health:ok|nodata|error" />
        <HelpRow title="Dashboard UID" expr="dashboard:eadde4c7-54e6-4964-85c0-484ab852fd04" />
        <HelpRow title="Contact point" expr="contactPoint:slack" />
      </div>
    </div>
  );
}

function HelpRow({ title, expr }: { title: string; expr: string }) {
  const styles = useStyles2(helpStyles);

  return (
    <>
      <div>{title}</div>
      <code className={styles.code}>{expr}</code>
    </>
  );
}

const helpStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'max-content auto',
    gap: theme.spacing(1),
    alignItems: 'center',
  }),
  code: css({
    display: 'block',
    textAlign: 'center',
  }),
});

function usePluginsFilterStatus() {
  const { components } = useAlertingHomePageExtensions();
  return { pluginsFilterEnabled: components.length > 0 };
}

export default RulesFilter;
