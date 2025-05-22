import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { FormProvider, SubmitHandler, useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Button,
  FilterInput,
  Grid,
  Input,
  Label,
  RadioButtonGroup,
  Select,
  Stack,
  Tab,
  TabsBar,
  useStyles2,
} from '@grafana/ui';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { PopupCard } from '../../HoverCard';

import { useListViewMode } from './RulesViewModeSelector';

type ActiveTab = 'custom' | 'saved';
type FilterForm = {
  searchQuery: string;
  ruleState: PromAlertingRuleState | '*'; // "*" means any state
};

export default function RulesFilter() {
  const { t } = useTranslate();
  const styles = useStyles2(getStyles);

  const [activeTab, setActiveTab] = useState<ActiveTab>('custom');
  const { searchQuery, clearAll } = useRulesFilter();

  const formContext = useForm<FilterForm>({
    defaultValues: {
      searchQuery,
      ruleState: '*',
    },
  });
  const { watch, setValue, handleSubmit, reset } = formContext;

  const onSubmit: SubmitHandler<FilterForm> = (values) => {
    console.log('submit', values);
  };

  const totalQuery = watch('searchQuery');
  useEffect(() => {
    if (totalQuery === '') {
      clearAll();
    }
  }, [clearAll, totalQuery]);

  const filterButtonLabel = t('alerting.rules-filter.filter-options.aria-label-show-filters', 'Filter');

  return (
    <FormProvider {...formContext}>
      <form onSubmit={handleSubmit(onSubmit)} onReset={() => reset()}>
        <Stack direction="row">
          <FilterInput
            data-testid="search-query-input"
            placeholder={t(
              'alerting.rules-filter.filter-options.placeholder-search-input',
              'Search by name or enter filter query...'
            )}
            name="searchQuery"
            onChange={(string) => setValue('searchQuery', string)}
            value={watch('searchQuery')}
          />
          <PopupCard
            showOn="click"
            placement="auto-end"
            content={
              <div className={styles.content}>
                {activeTab === 'custom' && <FilterOptions />}
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
          {/* show list view / group view */}
          <useListViewMode />
        </Stack>
      </form>
    </FormProvider>
  );
}

const FilterOptions = () => {
  const { setValue, watch } = useFormContext<FilterForm>();

  return (
    <Stack direction="column" alignItems="end" gap={2}>
      <Grid columns={2} gap={2} alignItems="center">
        <Label>
          <Trans i18nKey="alerting.search.property.namespace">Folder / Namespace</Trans>
        </Label>
        <Select options={[]} onChange={() => {}} />
        <Label>
          <Trans i18nKey="alerting.search.property.rule-name">Alerting rule name</Trans>
        </Label>
        <Input />
        <Label>
          <Trans i18nKey="alerting.search.property.evaluation-group">Evaluation group</Trans>
        </Label>
        <Input />
        <Label>
          <Trans i18nKey="alerting.search.property.labels">Labels</Trans>
        </Label>
        <Input />
        <Label>
          <Trans i18nKey="alerting.search.property.data-source">Data source</Trans>
        </Label>
        <Select options={[]} onChange={() => {}} />
        <Label>
          <Trans i18nKey="alerting.search.property.state">State</Trans>
        </Label>
        <RadioButtonGroup<PromAlertingRuleState | '*'>
          options={[
            { label: 'All', value: '*' },
            { label: 'Firing', value: PromAlertingRuleState.Firing },
            { label: 'Normal', value: PromAlertingRuleState.Inactive },
            { label: 'Pending', value: PromAlertingRuleState.Pending },
            { label: 'Recovering', value: PromAlertingRuleState.Recovering },
            { label: 'Unknown', value: PromAlertingRuleState.Unknown },
          ]}
          value={watch('ruleState')}
          onChange={(value) => setValue('ruleState', value)}
        />
        <Label>
          <Trans i18nKey="alerting.search.property.rule-type">Type</Trans>
        </Label>
        <RadioButtonGroup
          value={'*'}
          options={[
            { label: t('alerting.filter-options.label.all', 'All'), value: '*' },
            { label: t('alerting.filter-options.label.alert-rule', 'Alert rule'), value: 'alerting' },
            { label: t('alerting.filter-options.label.recording-rule', 'Recording rule'), value: 'recording' },
          ]}
        />
        <Label>
          <Trans i18nKey="alerting.search.property.rule-health">Health</Trans>
        </Label>
        <RadioButtonGroup
          value={'*'}
          options={[
            { label: t('alerting.filter-options.label.all', 'All'), value: '*' },
            { label: t('alerting.filter-options.label.ok', 'OK'), value: 'ok' },
            { label: t('alerting.filter-options.label.no-data', 'No data'), value: 'no_data' },
            { label: t('alerting.filter-options.label.error', 'Error'), value: 'error' },
          ]}
        />
      </Grid>
      <Stack direction="row" alignItems="center">
        <Button type="reset" variant="secondary">
          <Trans i18nKey="common.clear">Clear</Trans>
        </Button>
        <Button type="submit">
          <Trans i18nKey="common.apply">Apply</Trans>
        </Button>
      </Stack>
    </Stack>
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
  };
}
