import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, SubmitHandler, useForm, useFormContext, useWatch } from 'react-hook-form';

import { ContactPointSelector } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Box,
  Button,
  Combobox,
  FilterInput,
  Icon,
  Input,
  Label,
  MultiCombobox,
  RadioButtonGroup,
  Stack,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import type { AdvancedFilters } from 'app/features/alerting/unified/rule-list/filter/types';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import {
  trackAlertRuleFilterEvent,
  trackFilterButtonApplyClick,
  trackFilterButtonClearClick,
  trackFilterButtonClick,
  trackRulesSearchInputCleared,
} from '../../Analytics';
import { PopupCard } from '../../components/HoverCard';
import { RulesViewModeSelector } from '../../components/rules/Filter/RulesViewModeSelector';
import {
  useAlertingDataSourceOptions,
  useLabelOptions,
  useNamespaceAndGroupOptions,
} from '../../components/rules/Filter/useRuleFilterAutocomplete';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RuleHealth, getSearchFilterFromQuery } from '../../search/rulesSearchParser';

import { RulesFilterProps } from './RulesFilter';
import {
  emptyAdvancedFilters,
  formAdvancedFiltersToRuleFilter,
  searchQueryToDefaultValues,
  usePluginsFilterStatus,
  usePortalContainer,
} from './utils';

const canRenderContactPointSelector = contextSrv.hasPermission(AccessControlAction.AlertingReceiversRead);

type SearchQueryForm = {
  query: string;
};

export default function RulesFilter({ viewMode, onViewModeChange }: RulesFilterProps) {
  const styles = useStyles2(getStyles);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { searchQuery, updateFilters, setSearchQuery } = useRulesFilter();
  const popupRef = useRef<HTMLDivElement>(null);
  const { pluginsFilterEnabled } = usePluginsFilterStatus();

  // this form will managed the search query string, which is updated either by the user typing in the input or by the advanced filters
  const { control, setValue, handleSubmit } = useForm<SearchQueryForm>({
    defaultValues: {
      query: searchQuery,
    },
  });

  useEffect(() => {
    setValue('query', searchQuery);
  }, [searchQuery, setValue]);

  const submitHandler: SubmitHandler<SearchQueryForm> = (values: SearchQueryForm) => {
    const parsedFilter = getSearchFilterFromQuery(values.query);
    trackAlertRuleFilterEvent({ filterMethod: 'search-input', filter: parsedFilter });
    updateFilters(parsedFilter);
  };

  const handleAdvancedFilters: SubmitHandler<AdvancedFilters> = (values) => {
    const newFilter = formAdvancedFiltersToRuleFilter(values);
    updateFilters(newFilter);

    trackFilterButtonApplyClick(values, pluginsFilterEnabled);
    setIsPopupOpen(false); // Should close popup after applying filters?
  };

  const handleClearFilters = () => {
    updateFilters(formAdvancedFiltersToRuleFilter(emptyAdvancedFilters));
    setSearchQuery(undefined);
  };

  const handleOnToggle = () => {
    trackFilterButtonClick();
    setIsPopupOpen(!isPopupOpen);
  };

  // Handle outside clicks to close the popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isPopupOpen && popupRef.current && event.target instanceof Node && !popupRef.current.contains(event.target)) {
        // Check if click is on a portal element (combobox dropdown)
        if (event.target instanceof Element) {
          const isPortalClick =
            event.target.closest('[data-popper-placement]') || event.target.closest('[role="listbox"]');

          if (!isPortalClick) {
            setIsPopupOpen(false);
          }
        } else {
          setIsPopupOpen(false);
        }
      }
    };

    if (isPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopupOpen]);

  const filterButtonLabel = t('alerting.rules-filter.filter-options.aria-label-show-filters', 'Filter');
  return (
    <form onSubmit={handleSubmit(submitHandler)} onReset={() => {}}>
      <Stack direction="column" gap={1}>
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
        <Stack direction="row" alignItems="center" gap={1}>
          <Box flex={1}>
            <Controller
              name="query"
              control={control}
              render={({ field }) => (
                <FilterInput
                  id="rulesSearchInput"
                  data-testid="search-query-input"
                  placeholder={t(
                    'alerting.rules-filter.filter-options.placeholder-search-input',
                    'Search by name or enter filter query...'
                  )}
                  name="searchQuery"
                  onChange={(next) => {
                    trackRulesSearchInputCleared(field.value, next);
                    field.onChange(next);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'NumpadEnter') {
                      event.preventDefault();
                      handleSubmit(submitHandler)();
                    }
                  }}
                  onBlur={() => {
                    const currentQuery = field.value;
                    const parsedFilter = getSearchFilterFromQuery(currentQuery);
                    trackAlertRuleFilterEvent({ filterMethod: 'search-input', filter: parsedFilter });
                    updateFilters(parsedFilter);
                  }}
                  value={field.value}
                />
              )}
            />
          </Box>
          {/* the popup card is mounted inside of a portal, so we can't rely on the usual form handling mechanisms of button[type=submit] */}
          <PopupCard
            showOn="click"
            placement="auto"
            disableBlur={true}
            isOpen={isPopupOpen}
            onClose={() => setIsPopupOpen(false)}
            onToggle={handleOnToggle}
            content={
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
              <div
                ref={popupRef}
                className={styles.content}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
                role="dialog"
                aria-label={t('alerting.rules-filter.filter-options.aria-label', 'Filter options')}
                tabIndex={-1}
              >
                <FilterOptions
                  onSubmit={handleAdvancedFilters}
                  onClear={handleClearFilters}
                  pluginsFilterEnabled={pluginsFilterEnabled}
                />
              </div>
            }
          >
            <Button name="filter" icon="filter" variant="secondary" aria-label={filterButtonLabel}>
              {filterButtonLabel}
            </Button>
          </PopupCard>
          <RulesViewModeSelector viewMode={viewMode} onViewModeChange={onViewModeChange} />
        </Stack>
      </Stack>
    </form>
  );
}

interface FilterOptionsProps {
  onSubmit: SubmitHandler<AdvancedFilters>;
  onClear: () => void;
  pluginsFilterEnabled: boolean;
}

const FilterOptions = ({ onSubmit, onClear, pluginsFilterEnabled }: FilterOptionsProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { filterState } = useRulesFilter();
  const isManualResetRef = useRef(false);

  // Create portal container to render dropdowns above the popup modal
  const portalContainer = usePortalContainer(theme.zIndex.portal + 100);

  const defaultValues = searchQueryToDefaultValues(filterState);

  // turn the filterState into form default values
  const methods = useForm<AdvancedFilters>({
    defaultValues,
  });
  const { handleSubmit, reset } = methods;

  // Reactively watch selected data sources and only query externals when present
  const selectedDataSourceNamesRaw = useWatch({ control: methods.control, name: 'dataSourceNames' });
  const selectedDataSourceNames: string[] = Array.isArray(selectedDataSourceNamesRaw) ? selectedDataSourceNamesRaw : [];

  // Fetch namespace and group data from selected sources (optimized for filter UI)
  const { namespaceOptions, allGroupNames, isLoadingNamespaces, namespacePlaceholder, groupPlaceholder } =
    useNamespaceAndGroupOptions(selectedDataSourceNames);

  const { labelOptions, isLoadingGrafanaLabels } = useLabelOptions();

  // Create label options for the multi-select dropdown
  const dataSourceOptions = useAlertingDataSourceOptions();

  // Update form values when filterState changes (e.g., when popup reopens)
  useEffect(() => {
    // Skip if we're in the middle of a manual reset
    if (isManualResetRef.current) {
      isManualResetRef.current = false;
      return;
    }

    const newDefaultValues = searchQueryToDefaultValues(filterState);
    reset(newDefaultValues);
  }, [filterState, reset]);

  const submitAdvancedFilters = handleSubmit(onSubmit);

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={submitAdvancedFilters}
        onReset={() => {
          isManualResetRef.current = true;
          reset(emptyAdvancedFilters);
          trackFilterButtonClearClick();
          onClear();
        }}
      >
        <Stack direction="column" alignItems="end" gap={2}>
          <div className={styles.grid}>
            <RuleNameField />
            <LabelsField
              labelOptions={labelOptions}
              isLoadingGrafanaLabels={isLoadingGrafanaLabels}
              portalContainer={portalContainer}
            />
            <NamespaceField
              namespaceOptions={namespaceOptions}
              namespacePlaceholder={namespacePlaceholder}
              isLoadingNamespaces={isLoadingNamespaces}
              portalContainer={portalContainer}
            />
            <GroupField
              allGroupNames={allGroupNames}
              groupPlaceholder={groupPlaceholder}
              isLoadingNamespaces={isLoadingNamespaces}
              portalContainer={portalContainer}
            />
            <DataSourceNamesField dataSourceOptions={dataSourceOptions} portalContainer={portalContainer} />
            {canRenderContactPointSelector && <ContactPointField portalContainer={portalContainer} />}
            <RuleStateField />
            <RuleTypeField />
            <RuleHealthField />
            {pluginsFilterEnabled && <PluginsField />}
          </div>
          <Stack direction="row" alignItems="center">
            <Button type="reset" variant="secondary" data-testid="filter-clear-button">
              <Trans i18nKey="common.clear">Clear</Trans>
            </Button>
            <Button type="submit" data-testid="filter-apply-button">
              <Trans i18nKey="common.apply">Apply</Trans>
            </Button>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
};

function RuleNameField() {
  const { register } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.search.property.rule-name">Rule name</Trans>
      </Label>
      <Input {...register('ruleName')} data-testid="rule-name-input" />
    </>
  );
}

function LabelsField({
  labelOptions,
  isLoadingGrafanaLabels,
  portalContainer,
}: {
  labelOptions: Array<{ label?: string; value: string; infoOption?: boolean }>;
  isLoadingGrafanaLabels: boolean;
  portalContainer?: HTMLElement;
}) {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.search.property.labels">Labels</Trans>
      </Label>
      <Controller
        name="labels"
        control={control}
        render={({ field }) => (
          <MultiCombobox
            options={labelOptions}
            value={field.value}
            onChange={(selections) => field.onChange(selections.map((s) => s.value))}
            placeholder={
              isLoadingGrafanaLabels
                ? t('common.loading', 'Loading...')
                : t('alerting.rules-filter.placeholder-labels', 'Select labels')
            }
            loading={isLoadingGrafanaLabels}
            disabled={isLoadingGrafanaLabels || labelOptions.filter((option) => !option.infoOption).length === 0}
            portalContainer={portalContainer}
            width="auto"
            minWidth={40}
            maxWidth={80}
          />
        )}
      />
    </>
  );
}

function NamespaceField({
  namespaceOptions,
  namespacePlaceholder,
  isLoadingNamespaces,
  portalContainer,
}: {
  namespaceOptions: Array<{ label?: string; value: string; description?: string }>;
  namespacePlaceholder: string;
  isLoadingNamespaces: boolean;
  portalContainer?: HTMLElement;
}) {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.search.property.namespace">Folder / Namespace</Trans>
      </Label>
      <Controller
        name="namespace"
        control={control}
        render={({ field }) => {
          return (
            <Combobox<string>
              placeholder={namespacePlaceholder}
              options={namespaceOptions}
              onChange={(option) => field.onChange(option?.value || null)}
              value={field.value}
              loading={isLoadingNamespaces}
              disabled={isLoadingNamespaces || namespaceOptions.length === 0}
              isClearable
              portalContainer={portalContainer}
            />
          );
        }}
      />
    </>
  );
}

function GroupField({
  allGroupNames,
  groupPlaceholder,
  isLoadingNamespaces,
  portalContainer,
}: {
  allGroupNames: string[];
  groupPlaceholder: string;
  isLoadingNamespaces: boolean;
  portalContainer?: HTMLElement;
}) {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.search.property.evaluation-group">Evaluation group</Trans>
      </Label>
      <Controller
        name="groupName"
        control={control}
        render={({ field }) => {
          return (
            <Combobox<string>
              placeholder={groupPlaceholder}
              options={allGroupNames.map((name) => ({ label: name, value: name }))}
              onChange={(option) => field.onChange(option?.value || null)}
              value={field.value}
              loading={isLoadingNamespaces}
              disabled={isLoadingNamespaces || allGroupNames.length === 0}
              isClearable
              portalContainer={portalContainer}
            />
          );
        }}
      />
    </>
  );
}

function DataSourceNamesField({
  dataSourceOptions,
  portalContainer,
}: {
  dataSourceOptions: Array<{ label?: string; value: string }>;
  portalContainer?: HTMLElement;
}) {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Stack gap={0.5} alignItems="center">
          <span>
            <Trans i18nKey="alerting.search.property.data-source">Data source</Trans>
          </span>
          <Tooltip
            content={
              <div>
                <p>
                  <Trans i18nKey="alerting.rules-filter.configured-alert-rules">
                    Data sources containing configured alert rules are Mimir or Loki data sources where alert rules are
                    stored and evaluated in the data source itself.
                  </Trans>
                </p>
                <p>
                  <Trans i18nKey="alerting.rules-filter.manage-alerts">
                    In these data sources, you can select Manage alerts via Alerting UI to be able to manage these alert
                    rules in the Grafana UI as well as in the data source where they were configured.
                  </Trans>
                </p>
              </div>
            }
          >
            <Icon
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
      <Controller
        name="dataSourceNames"
        control={control}
        render={({ field }) => (
          <MultiCombobox
            options={dataSourceOptions}
            value={field.value}
            onChange={(selections) => field.onChange(selections.map((s) => s.value))}
            placeholder={t('alerting.rules-filter.placeholder-data-sources', 'Select data sources')}
            portalContainer={portalContainer}
            width="auto"
            minWidth={40}
            maxWidth={80}
          />
        )}
      />
    </>
  );
}

function ContactPointField({ portalContainer }: { portalContainer?: HTMLElement }) {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Stack gap={0.5} alignItems="center">
          <span>
            <Trans i18nKey="alerting.contactPointFilter.label">Contact point</Trans>
          </span>
          <Tooltip
            content={
              <Trans i18nKey="alerting.rules-filter.contact-point-tooltip">
                Filters alert rules which route directly to the selected contact point. Alert rules routed to
                notification policies will not be displayed.
              </Trans>
            }
          >
            <Icon
              name="info-circle"
              size="sm"
              title={t('alerting.rules-filter.contact-point-tooltip-title', 'Contact point filter help')}
            />
          </Tooltip>
        </Stack>
      </Label>
      <Controller
        name="contactPoint"
        control={control}
        render={({ field }) => {
          return (
            <ContactPointSelector
              placeholder={t('alerting.rules-filter.placeholder-contact-point', 'Select contact point')}
              value={field.value}
              isClearable
              onChange={(contactPoint) => {
                field.onChange(contactPoint?.spec.title || null);
              }}
              portalContainer={portalContainer}
            />
          );
        }}
      />
    </>
  );
}

function RuleStateField() {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.search.property.state">State</Trans>
      </Label>
      <Controller
        name="ruleState"
        control={control}
        render={({ field }) => (
          <RadioButtonGroup<AdvancedFilters['ruleState']>
            options={[
              { label: t('common.all', 'All'), value: '*' },
              { label: t('alerting.rules.state.firing', 'Firing'), value: PromAlertingRuleState.Firing },
              { label: t('alerting.rules.state.normal', 'Normal'), value: PromAlertingRuleState.Inactive },
              { label: t('alerting.rules.state.pending', 'Pending'), value: PromAlertingRuleState.Pending },
              { label: t('alerting.rules.state.recovering', 'Recovering'), value: PromAlertingRuleState.Recovering },
              { label: t('alerting.rules.state.unknown', 'Unknown'), value: PromAlertingRuleState.Unknown },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </>
  );
}

function RuleTypeField() {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.search.property.rule-type">Type</Trans>
      </Label>
      <Controller
        name="ruleType"
        control={control}
        render={({ field }) => (
          <RadioButtonGroup<AdvancedFilters['ruleType']>
            options={[
              { label: t('common.all', 'All'), value: '*' },
              { label: t('alerting.rules.type.alert', 'Alert rule'), value: PromRuleType.Alerting },
              { label: t('alerting.rules.type.recording', 'Recording rule'), value: PromRuleType.Recording },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </>
  );
}

function RuleHealthField() {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.search.property.rule-health">Health</Trans>
      </Label>
      <Controller
        name="ruleHealth"
        control={control}
        render={({ field }) => (
          <RadioButtonGroup<AdvancedFilters['ruleHealth']>
            options={[
              { label: t('common.all', 'All'), value: '*' },
              { label: t('alerting.rules.health.ok', 'OK'), value: RuleHealth.Ok },
              { label: t('alerting.rules.health.no-data', 'No data'), value: RuleHealth.NoData },
              { label: t('alerting.rules.health.error', 'Error'), value: RuleHealth.Error },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </>
  );
}

function PluginsField() {
  const { control } = useFormContext<AdvancedFilters>();
  return (
    <>
      <Label>
        <Trans i18nKey="alerting.rules-filter.plugin-rules">Plugin rules</Trans>
      </Label>
      <Controller
        name="plugins"
        control={control}
        render={({ field }) => (
          <RadioButtonGroup<AdvancedFilters['plugins']>
            options={[
              { label: t('alerting.rules-filter.label.show', 'Show'), value: 'show' },
              { label: t('alerting.rules-filter.label.hide', 'Hide'), value: 'hide' },
            ]}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </>
  );
}

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

function getStyles(theme: GrafanaTheme2) {
  return {
    content: css({
      padding: theme.spacing(1),
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
  };
}
