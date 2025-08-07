import { css } from '@emotion/css';
import { pickBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { ContactPoint, ContactPointSelector } from '@grafana/alerting/unstable';
import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  Button,
  Combobox,
  ComboboxOption,
  FilterInput,
  Icon,
  Input,
  Label,
  MultiCombobox,
  RadioButtonGroup,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { trackFilterButtonApplyClick, trackFilterButtonClearClick, trackFilterButtonClick } from '../../../Analytics';
import { alertRuleApi } from '../../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../../api/featureDiscoveryApi';
import { useGetLabelsFromDataSourceName } from '../../../components/rule-editor/useAlertRuleSuggestions';
import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { useAlertingHomePageExtensions } from '../../../plugins/useAlertingHomePageExtensions';
import { RuleHealth, applySearchFilterToQuery, getSearchFilterFromQuery } from '../../../search/rulesSearchParser';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSources } from '../../../utils/datasource';
import { PopupCard } from '../../HoverCard';

import { RulesViewModeSelector } from './RulesViewModeSelector';
import { emptyAdvancedFilters, formAdvancedFiltersToRuleFilter, searchQueryToDefaultValues } from './utils';

const canRenderContactPointSelector = contextSrv.hasPermission(AccessControlAction.AlertingReceiversRead);

/**
 * Custom hook that creates a DOM container for rendering dropdowns outside of popup stacking contexts.
 * This prevents dropdowns from appearing behind modals/popups due to CSS stacking context limitations.
 *
 * @param zIndex - The z-index value for the portal container
 * @returns HTMLDivElement container appended to document.body, or undefined during initial render
 */
function usePortalContainer(zIndex: number): HTMLElement | undefined {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: String(zIndex),
    });

    document.body.appendChild(container);
    containerRef.current = container;

    return () => {
      container.remove();
    };
  }, [zIndex]);

  return containerRef.current || undefined;
}

export type AdvancedFilters = {
  namespace?: string | null;
  groupName?: string | null;
  ruleName?: string;
  ruleType?: PromRuleType | '*';
  ruleState: PromAlertingRuleState | '*';
  dataSourceNames: string[];
  labels: string[];
  ruleHealth?: RuleHealth | '*';
  dashboardUid?: string;
  plugins?: 'show' | 'hide';
  contactPoint?: string | null;
};

type SearchQueryForm = {
  query: string;
};

export default function RulesFilter() {
  const styles = useStyles2(getStyles);

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { searchQuery, updateFilters } = useRulesFilter();
  const popupRef = useRef<HTMLDivElement>(null);

  // Check if plugins filter is enabled
  const { components } = useAlertingHomePageExtensions();
  const pluginsFilterEnabled = components.length > 0;

  // this form will managed the search query string, which is updated either by the user typing in the input or by the advanced filters
  const { setValue, watch, handleSubmit } = useForm<SearchQueryForm>({
    defaultValues: {
      query: searchQuery,
    },
  });

  const submitHandler: SubmitHandler<SearchQueryForm> = (values: SearchQueryForm) => {
    const parsedFilter = getSearchFilterFromQuery(values.query);
    updateFilters(parsedFilter);
  };

  const handleAdvancedFilters: SubmitHandler<AdvancedFilters> = (values) => {
    const newFilter = formAdvancedFiltersToRuleFilter(values);
    updateFilters(newFilter);

    const newSearchQuery = applySearchFilterToQuery('', newFilter);
    setValue('query', newSearchQuery);

    // Filter out empty/default values before tracking
    const meaningfulValues = pickBy(values, (value, key) => {
      if (value === null || value === undefined || value === '') {
        return false;
      }
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
      if (key === 'plugins' && !pluginsFilterEnabled) {
        return false;
      }
      return true;
    });

    trackFilterButtonApplyClick(meaningfulValues);
    setIsPopupOpen(false); // Should close popup after applying filters?
  };

  const handleClearFilters = () => {
    updateFilters(formAdvancedFiltersToRuleFilter(emptyAdvancedFilters));
    setValue('query', '');
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
      <Stack direction="row">
        <FilterInput
          data-testid="search-query-input"
          placeholder={t(
            'alerting.rules-filter.filter-options.placeholder-search-input',
            'Search by name or enter filter query...'
          )}
          name="searchQuery"
          onChange={(string) => setValue('query', string)}
          onBlur={() => {
            const currentQuery = watch('query');
            const parsedFilter = getSearchFilterFromQuery(currentQuery);
            updateFilters(parsedFilter);
          }}
          value={watch('query')}
        />
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
        {/* show list view / group view */}
        <RulesViewModeSelector />
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
  const theme = useStyles2((theme) => theme);
  const { filterState } = useRulesFilter();
  const isManualResetRef = useRef(false);

  // Create portal container to render dropdowns above the popup modal
  const portalContainer = usePortalContainer(theme.zIndex.portal + 100);

  const defaultValues = searchQueryToDefaultValues(filterState);

  // Fetch namespace and group data from all sources
  const { currentData: grafanaPromRules = [], isLoading: isLoadingGrafanaPromRules } =
    alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    });

  const { isLoading: isLoadingGrafanaRulerRules } = alertRuleApi.endpoints.rulerRules.useQuery({
    rulerConfig: GRAFANA_RULER_CONFIG,
  });

  const externalDataSources = useMemo(getRulesDataSources, []);

  const externalPromRulesQueries = externalDataSources.map((ds) =>
    alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery({
      ruleSourceName: ds.name,
    })
  );

  const isLoadingNamespaces = useMemo(() => {
    return (
      isLoadingGrafanaPromRules ||
      isLoadingGrafanaRulerRules ||
      externalPromRulesQueries.some((query) => query.isLoading)
    );
  }, [isLoadingGrafanaPromRules, isLoadingGrafanaRulerRules, externalPromRulesQueries]);

  // Combine all namespace data
  const allNamespaceNames = useMemo(() => {
    const namespaceSet = new Set<string>();

    // Add Grafana namespaces
    grafanaPromRules.forEach((namespace) => namespaceSet.add(namespace.name));

    // Add external data source namespaces
    externalPromRulesQueries.forEach((query) => {
      query.currentData?.forEach((namespace) => namespaceSet.add(namespace.name));
    });

    return Array.from(namespaceSet).sort();
  }, [grafanaPromRules, externalPromRulesQueries]);

  // Create namespace options with better display names and grouping
  const namespaceOptions = useMemo((): Array<ComboboxOption<string>> => {
    const grafanaFolders: Array<ComboboxOption<string>> = [];
    const externalFiles: Array<ComboboxOption<string>> = [];

    allNamespaceNames.forEach((namespace) => {
      // Handle file paths from external Prometheus data sources
      if (namespace.includes('/') && (namespace.endsWith('.yml') || namespace.endsWith('.yaml'))) {
        const filename = namespace.split('/').pop() || namespace;
        externalFiles.push({
          label: filename,
          value: namespace,
          description: namespace, // Show full path as description
        });
      } else {
        // Grafana managed folder
        grafanaFolders.push({
          label: namespace,
          value: namespace,
          description: t('alerting.rules-filter.grafana-folder', 'Grafana folder'),
        });
      }
    });

    // Sort each group and combine (folders first, then external files)
    // eslint-disable-next-line no-restricted-syntax
    grafanaFolders.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    // eslint-disable-next-line no-restricted-syntax
    externalFiles.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

    return [...grafanaFolders, ...externalFiles];
  }, [allNamespaceNames]);

  // Combine all group names
  const allGroupNames = useMemo(() => {
    const groupSet = new Set<string>();

    // Add Grafana groups
    grafanaPromRules.forEach((namespace) => {
      namespace.groups.forEach((group) => groupSet.add(group.name));
    });

    // Add external data source groups
    externalPromRulesQueries.forEach((query) => {
      query.currentData?.forEach((namespace) => {
        namespace.groups.forEach((group) => groupSet.add(group.name));
      });
    });

    return Array.from(groupSet).sort();
  }, [grafanaPromRules, externalPromRulesQueries]);

  const { labels: grafanaLabels, isLoading: isLoadingGrafanaLabels } =
    useGetLabelsFromDataSourceName(GRAFANA_RULES_SOURCE_NAME);

  // Create label options for the multi-select dropdown
  const labelOptions = useMemo((): Array<ComboboxOption<string>> => {
    const options: Array<ComboboxOption<string>> = [];

    grafanaLabels.forEach((values, key) => {
      values.forEach((value) => {
        const labelPair = `${key}=${value}`;
        options.push({
          label: labelPair,
          value: labelPair,
          description: `Label: ${key}, Value: ${value}`,
        });
      });
    });

    // eslint-disable-next-line no-restricted-syntax
    return options.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  }, [grafanaLabels]);

  // Generate appropriate placeholder text
  const namespacePlaceholder = useMemo(() => {
    if (isLoadingNamespaces) {
      return t('common.loading', 'Loading...');
    }
    if (namespaceOptions.length === 0) {
      return t('alerting.rules-filter.no-namespaces', 'No folders available');
    }
    return t('alerting.rules-filter.filter-options.placeholder-namespace', 'Select namespace');
  }, [isLoadingNamespaces, namespaceOptions.length]);

  const groupPlaceholder = useMemo(() => {
    if (isLoadingNamespaces) {
      return t('common.loading', 'Loading...');
    }
    if (allGroupNames.length === 0) {
      return t('alerting.rules-filter.no-groups', 'No groups available');
    }
    return t('grafana.select-group', 'Select group');
  }, [isLoadingNamespaces, allGroupNames.length]);

  // turn the filterState into form default values
  const { handleSubmit, reset, register, control } = useForm<AdvancedFilters>({
    defaultValues,
  });

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

  const dataSourceOptions = useMemo(() => {
    return getDataSourceSrv()
      .getList({ alerting: true })
      .map((ds: DataSourceInstanceSettings) => ({ label: ds.name, value: ds.name }));
  }, []);

  return (
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
          <Label>
            <Trans i18nKey="alerting.search.property.rule-name">Rule name</Trans>
          </Label>
          <Input {...register('ruleName')} data-testid="rule-name-input" />
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
                disabled={isLoadingGrafanaLabels || labelOptions.length === 0}
                portalContainer={portalContainer}
                width="auto"
                minWidth={40}
                maxWidth={80}
              />
            )}
          />
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
          <Label>
            <Trans i18nKey="alerting.search.property.data-source">Data source</Trans>
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
          {canRenderContactPointSelector && (
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
                      onChange={(contactPoint: ContactPoint | null) => {
                        field.onChange(contactPoint?.spec.title || null);
                      }}
                      portalContainer={portalContainer}
                    />
                  );
                }}
              />
            </>
          )}
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
                  {
                    label: t('alerting.rules.state.recovering', 'Recovering'),
                    value: PromAlertingRuleState.Recovering,
                  },
                  { label: t('alerting.rules.state.unknown', 'Unknown'), value: PromAlertingRuleState.Unknown },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
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
          {pluginsFilterEnabled && (
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
          )}
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
  );
};

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
