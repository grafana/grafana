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
  FilterInput,
  Input,
  Label,
  MultiCombobox,
  RadioButtonGroup,
  Stack,
  Tab,
  TabsBar,
  useStyles2,
} from '@grafana/ui';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { RuleHealth } from '../../../search/rulesSearchParser';
import { PopupCard } from '../../HoverCard';

import { RulesViewModeSelector } from './RulesViewModeSelector';
import { emptyAdvancedFilters, formAdvancedFiltersToRuleFilter, searchQueryToDefaultValues } from './utils';

/**
 * Creates a portal container outside the current stacking context for dropdowns
 * that need to appear above popups/modals
 */
function usePortalContainer(zIndex: number) {
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

  return containerRef.current;
}

type ActiveTab = 'custom' | 'saved';
export type AdvancedFilters = {
  namespace?: string;
  groupName?: string;
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

  const [activeTab, setActiveTab] = useState<ActiveTab>('custom');
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
            placement="auto-end"
            disableBlur={true}
            isOpen={isPopupOpen}
            onClose={() => setIsPopupOpen(false)}
            onToggle={() => setIsPopupOpen(!isPopupOpen)}
            content={
              <div className={styles.content} onClick={(e) => e.stopPropagation()}>
                {activeTab === 'custom' && (
                  <FilterOptions onSubmit={handleAdvancedFilters} onClear={handleClearFilters} />
                )}
                {/* {activeTab === 'saved' && <SavedSearches />} */}
              </div>
            }
            header={
              <TabsBar hideBorder className={styles.fixTabsMargin}>
                <Tab
                  active={activeTab === 'custom'}
                  icon="filter"
                  label={t('alerting.rules-filter.filter-options.label-custom-filter', 'Custom filter')}
                  onChangeTab={() => setActiveTab('custom')}
                />
                {/* <Tab
                  active={activeTab === 'saved'}
                  icon="bookmark"
                  label={t('alerting.rules-filter.filter-options.label-saved-searches', 'Saved searches')}
                  onChangeTab={() => setActiveTab('saved')}
                /> */}
              </TabsBar>
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

  // Create portal container outside popup's stacking context
  const portalContainer = usePortalContainer(theme.zIndex.portal + 100);

  const defaultValues = searchQueryToDefaultValues(filterState);

  // turn the filterState into form default values
  const { handleSubmit, reset, register, control } = useForm<AdvancedFilters>({
    defaultValues,
  });

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
            render={({ field }) => (
              <Combobox<string>
                placeholder={t('alerting.rules-filter.filter-options.placeholder-namespace', 'Select namespace')}
                options={[]}
                onChange={field.onChange}
                value={field.value}
                isClearable
              />
            )}
          />
          <Label>
            <Trans i18nKey="alerting.search.property.evaluation-group">Evaluation group</Trans>
          </Label>
          <Input {...register('groupName')} />
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
                placeholder="Select data sources"
                portalContainer={portalContainer || undefined}
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
                  { label: 'All', value: '*' },
                  { label: 'Firing', value: PromAlertingRuleState.Firing },
                  { label: 'Normal', value: PromAlertingRuleState.Inactive },
                  { label: 'Pending', value: PromAlertingRuleState.Pending },
                  { label: 'Recovering', value: PromAlertingRuleState.Recovering },
                  { label: 'Unknown', value: PromAlertingRuleState.Unknown },
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
                  { label: 'All', value: '*' },
                  { label: 'Alert rule', value: PromRuleType.Alerting },
                  { label: 'Recording rule', value: PromRuleType.Recording },
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
                  { label: 'All', value: '*' },
                  { label: 'OK', value: RuleHealth.Ok },
                  { label: 'No data', value: RuleHealth.NoData },
                  { label: 'Error', value: RuleHealth.Error },
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
    fixTabsMargin: css({
      marginTop: theme.spacing(-1),
    }),
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(2, auto)',
      alignItems: 'center',
      gap: theme.spacing(2),
    }),
  };
}
