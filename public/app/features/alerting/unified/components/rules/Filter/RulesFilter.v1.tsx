import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ContactPointSelector } from '@grafana/alerting/unstable';
import { DataSourceInstanceSettings, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Icon, Input, Label, RadioButtonGroup, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
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
import { alertStateToReadable } from '../../../utils/rules';
import { PopupCard } from '../../HoverCard';
import { MultipleDataSourcePicker } from '../MultipleDataSourcePicker';

import { RulesViewModeSelector, SupportedView } from './RulesViewModeSelector';

const RuleTypeOptions: SelectableValue[] = [
  { label: 'Alert ', value: PromRuleType.Alerting },
  { label: 'Recording ', value: PromRuleType.Recording },
];

const RuleHealthOptions: SelectableValue[] = [
  { label: 'Ok', value: RuleHealth.Ok },
  { label: 'No Data', value: RuleHealth.NoData },
  { label: 'Error', value: RuleHealth.Error },
];

// Contact point selector is not supported in Alerting ListView V2 yet
const canRenderContactPointSelector = contextSrv.hasPermission(AccessControlAction.AlertingReceiversRead);

interface RulesFilerProps {
  onClear?: () => void;
  viewMode?: SupportedView;
  onViewModeChange?: (viewMode: SupportedView) => void;
}

const RuleStateOptions = Object.entries(PromAlertingRuleState)
  .filter(([key, value]) => value !== PromAlertingRuleState.Unknown) // Exclude Unknown state from filter options
  .map(([key, value]) => ({
    label: alertStateToReadable(value),
    value,
  }));

const RulesFilter = ({ onClear = () => undefined, viewMode, onViewModeChange }: RulesFilerProps) => {
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

  const searchIcon = <Icon name={'search'} />;

  return (
    <Stack direction="column" gap={0}>
      <Stack direction="row" gap={1} wrap="wrap">
        <Field
          className={styles.dsPickerContainer}
          label={
            <Label htmlFor="data-source-picker">
              <Stack gap={0.5} alignItems="center">
                <span>
                  <Trans i18nKey="alerting.rules-filter.search-by-data-sources">Search by data sources</Trans>
                </span>
                <Tooltip
                  content={
                    <div>
                      <p>
                        <Trans i18nKey="alerting.rules-filter.configured-alert-rules">
                          Data sources containing configured alert rules are Mimir or Loki data sources where alert
                          rules are stored and evaluated in the data source itself.
                        </Trans>
                      </p>
                      <p>
                        <Trans i18nKey="alerting.rules-filter.manage-alerts">
                          In these data sources, you can select Manage alerts via Alerting UI to be able to manage these
                          alert rules in the Grafana UI as well as in the data source where they were configured.
                        </Trans>
                      </p>
                    </div>
                  }
                >
                  <Icon
                    id="data-source-picker-inline-help"
                    name="info-circle"
                    size="sm"
                    title={t(
                      'alerting.rules-filter.data-source-picker-inline-help-title-search-by-data-sources-help',
                      'Search by data sources help'
                    )}
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
            placeholder={t('alerting.rules-filter.placeholder-all-data-sources', 'All data sources')}
            current={filterState.dataSourceNames}
            onChange={handleDataSourceChange}
            onClear={clearDataSource}
          />
        </Field>

        <Field
          className={styles.dashboardPickerContainer}
          label={
            <Label htmlFor="filters-dashboard-picker">
              <Trans i18nKey="alerting.rules-filter.dashboard">Dashboard</Trans>
            </Label>
          }
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
          <Label>
            <Trans i18nKey="alerting.rules-filter.state">State</Trans>
          </Label>
          <RadioButtonGroup
            options={RuleStateOptions}
            value={filterState.ruleState}
            onChange={handleAlertStateChange}
          />
        </div>
        <div>
          <Label>
            <Trans i18nKey="alerting.rules-filter.rule-type">Rule type</Trans>
          </Label>
          <RadioButtonGroup options={RuleTypeOptions} value={filterState.ruleType} onChange={handleRuleTypeChange} />
        </div>
        <div>
          <Label>
            <Trans i18nKey="alerting.rules-filter.health">Health</Trans>
          </Label>
          <RadioButtonGroup
            options={RuleHealthOptions}
            value={filterState.ruleHealth}
            onChange={handleRuleHealthChange}
          />
        </div>
        {canRenderContactPointSelector && (
          <Stack direction="column" gap={0}>
            <Field
              label={
                <Label htmlFor="contactPointFilter">
                  <Trans i18nKey="alerting.contactPointFilter.label">Contact point</Trans>
                </Label>
              }
            >
              <ContactPointSelector
                id="contactPointFilter"
                value={filterState.contactPoint ?? null}
                width={40}
                placeholder={t(
                  'alerting.notification-policies-filter.placeholder-search-by-contact-point',
                  'Choose a contact point'
                )}
                isClearable
                onChange={(contactPoint) => {
                  handleContactPointChange(contactPoint?.spec.title ?? '');
                }}
              />
            </Field>
          </Stack>
        )}
        {pluginsFilterEnabled && (
          <div>
            <Label>
              <Trans i18nKey="alerting.rules-filter.plugin-rules">Plugin rules</Trans>
            </Label>
            <RadioButtonGroup<'hide'>
              options={[
                { label: t('alerting.rules-filter.label.show', 'Show'), value: undefined },
                { label: t('alerting.rules-filter.label.hide', 'Hide'), value: 'hide' },
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
                    <span>
                      <Trans i18nKey="alerting.rules-filter.search">Search</Trans>
                    </span>
                    <PopupCard content={<SearchQueryHelp />}>
                      <Icon
                        name="info-circle"
                        size="sm"
                        tabIndex={0}
                        title={t('alerting.rules-filter.title-search-help', 'Search help')}
                      />
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
                placeholder={t('alerting.rules-filter.rulesSearchInput-placeholder-search', 'Search')}
                data-testid="search-query-input"
              />
            </Field>
            <input type="submit" hidden />
          </form>
          <div>
            <Label>
              <Trans i18nKey="alerting.rules-filter.view-as">View as</Trans>
            </Label>
            <RulesViewModeSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />
          </div>
        </Stack>
        {hasActiveFilters && (
          <div>
            <Button fullWidth={false} icon="times" variant="secondary" onClick={handleClearFiltersClick}>
              <Trans i18nKey="alerting.rules-filter.clear-filters">Clear filters</Trans>
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
      <div>
        <Trans i18nKey="alerting.search-query-help.search-syntax">
          Search syntax allows to query alert rules by the parameters defined below.
        </Trans>
      </div>
      <hr />
      <div className={styles.grid}>
        <div>
          <Trans i18nKey="alerting.search-query-help.filter-type">Filter type</Trans>
        </div>
        <div>
          <Trans i18nKey="alerting.search-query-help.expression">Expression</Trans>
        </div>
        <HelpRow
          title={t('alerting.search-query-help.title-datasources', 'Datasources')}
          expr="datasource:mimir datasource:prometheus"
        />
        <HelpRow
          title={t('alerting.search-query-help.title-folder-namespace', 'Folder/Namespace')}
          expr="namespace:global"
        />
        <HelpRow title={t('alerting.search-query-help.title-group', 'Group')} expr="group:cpu-usage" />
        <HelpRow title={t('alerting.search-query-help.title-rule', 'Rule')} expr='rule:"cpu 80%"' />
        <HelpRow title={t('alerting.search-query-help.title-labels', 'Labels')} expr="label:team=A label:cluster=a1" />
        <HelpRow title={t('alerting.search-query-help.title-state', 'State')} expr="state:firing|normal|pending" />
        <HelpRow title={t('alerting.search-query-help.title-type', 'Type')} expr="type:alerting|recording" />
        <HelpRow title={t('alerting.search-query-help.title-health', 'Health')} expr="health:ok|nodata|error" />
        <HelpRow
          title={t('alerting.search-query-help.title-dashboard-uid', 'Dashboard UID')}
          expr="dashboard:eadde4c7-54e6-4964-85c0-484ab852fd04"
        />
        <HelpRow
          title={t('alerting.search-query-help.title-contact-point', 'Contact point')}
          expr="contactPoint:slack"
        />
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
