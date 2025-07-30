import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  Button,
  ClickOutsideWrapper,
  Combobox,
  ComboboxOption,
  FilterInput,
  Input,
  Label,
  MultiCombobox,
  RadioButtonGroup,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../../api/featureDiscoveryApi';
import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { RuleHealth } from '../../../search/rulesSearchParser';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSources } from '../../../utils/datasource';
import { PopupCard } from '../../HoverCard';

import { RulesViewModeSelector } from './RulesViewModeSelector';
import { emptyAdvancedFilters, formAdvancedFiltersToRuleFilter, searchQueryToDefaultValues } from './utils';

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
  ruleState: PromAlertingRuleState | '*'; // "*" means any state
  dataSourceNames: string[];
  labels: string[];
  ruleHealth?: RuleHealth | '*';
  dashboardUid?: string;
  // @TODO add support to hide / show only certain plugins
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

  // this form will managed the search query string, which is updated either by the user typing in the input or by the advanced filters
  const { setValue, watch, handleSubmit } = useForm<SearchQueryForm>({
    defaultValues: {
      query: searchQuery,
    },
  });

  const submitHandler: SubmitHandler<SearchQueryForm> = (values: SearchQueryForm) => {
    // Handle search query form submission if needed
  };

  const handleAdvancedFilters: SubmitHandler<AdvancedFilters> = (values) => {
    updateFilters(formAdvancedFiltersToRuleFilter(values));
    setIsPopupOpen(false); // Should close popup after applying filters?
  };

  const handleClearFilters = () => {
    updateFilters(formAdvancedFiltersToRuleFilter(emptyAdvancedFilters));
  };

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
          value={watch('query')}
        />
        {/* the popup card is mounted inside of a portal, so we can't rely on the usual form handling mechanisms of button[type=submit] */}
        <ClickOutsideWrapper onClick={() => setIsPopupOpen(false)}>
          <PopupCard
            showOn="click"
            placement="auto"
            disableBlur={true}
            isOpen={isPopupOpen}
            onClose={() => setIsPopupOpen(false)}
            onToggle={() => setIsPopupOpen(!isPopupOpen)}
            content={
              <div
                className={styles.content}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
                role="region"
                tabIndex={-1}
              >
                <FilterOptions onSubmit={handleAdvancedFilters} onClear={handleClearFilters} />
              </div>
            }
          >
            <Button name="filter" icon="filter" variant="secondary" aria-label={filterButtonLabel}>
              {filterButtonLabel}
            </Button>
          </PopupCard>
        </ClickOutsideWrapper>
        {/* show list view / group view */}
        <RulesViewModeSelector />
      </Stack>
    </form>
  );
}

interface FilterOptionsProps {
  onSubmit: SubmitHandler<AdvancedFilters>;
  onClear: () => void;
}

const FilterOptions = ({ onSubmit, onClear }: FilterOptionsProps) => {
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
        onClear();
      }}
    >
      <Stack direction="column" alignItems="end" gap={2}>
        <div className={styles.grid}>
          <Label>
            <Trans i18nKey="alerting.search.property.rule-name">Rule name</Trans>
          </Label>
          <Input {...register('ruleName')} />
          <Label>
            <Trans i18nKey="alerting.search.property.labels">Labels</Trans>
          </Label>
          {/* @TODO some visual label picker */}
          <Input {...register('labels')} />
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
          <Label>
            <Trans i18nKey="alerting.search.property.state">State</Trans>
          </Label>
          {/* Should be able to select multiple states? */}
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
        </div>
        <Stack direction="row" alignItems="center">
          <Button type="reset" variant="secondary">
            <Trans i18nKey="common.clear">Clear</Trans>
          </Button>
          <Button type="submit">
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
      gridTemplateColumns: 'repeat(2, auto)',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
  };
}
