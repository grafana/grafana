import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Button,
  Combobox,
  FilterInput,
  Input,
  Label,
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
import { MultipleDataSourcePicker } from '../MultipleDataSourcePicker';

import { RulesViewModeSelector } from './RulesViewModeSelector';
import { emptyAdvancedFilters, formAdvancedFiltersToRuleFilter, searchQueryToDefaultValues } from './utils';

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
  const popupRef = useRef<HTMLDivElement>(null);

  // Custom click-outside handler that's aware of data source picker portals
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isPopupOpen) {
        return;
      }

      // Check if the click target is a valid Element
      if (!event.target || !(event.target instanceof Element)) {
        return;
      }

      const target = event.target;

      if (popupRef.current?.contains(target)) {
        return;
      }

      if (target.closest('[role="tooltip"]')) {
        return;
      }

      if (
        target.closest('[data-testid*="select"]') ||
        target.closest('.react-select__menu') ||
        target.closest('.select__menu') ||
        target.closest('[class*="menu"]') ||
        target.closest('[class*="option"]') ||
        target.closest('[class*="dropdown"]') ||
        target.closest('[class*="popover"]')
      ) {
        return;
      }

      setIsPopupOpen(false);
    };

    if (isPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopupOpen]);

  // this form will managed the search query string, which is updated either by the user typing in the input or by the advanced filters
  const { setValue, watch, handleSubmit } = useForm<SearchQueryForm>({
    defaultValues: {
      query: searchQuery,
    },
  });

  const submitHandler: SubmitHandler<SearchQueryForm> = (values: SearchQueryForm) => {
    console.log('search Query', values);
    console.log('handleAdvancedFilters', values);
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
        <div ref={popupRef}>
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
        </div>
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
  const { filterState } = useRulesFilter();

  const defaultValues = searchQueryToDefaultValues(filterState);

  // turn the filterState into form default values
  const { handleSubmit, reset, register, control } = useForm<AdvancedFilters>({
    defaultValues,
  });

  const submitAdvancedFilters = handleSubmit(onSubmit);

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
              <MultipleDataSourcePicker
                alerting
                noDefault
                placeholder="Select data sources"
                current={field.value}
                onChange={(dataSource, action) => {
                  const currentValues = field.value || [];
                  const newValues =
                    action === 'add'
                      ? [...currentValues, dataSource.name]
                      : currentValues.filter((name) => name !== dataSource.name);
                  field.onChange(newValues);
                }}
                onClear={() => field.onChange([])}
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
