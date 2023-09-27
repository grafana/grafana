import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Button, Field, Icon, Input, Label, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { LogMessages } from '../../Analytics';
import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RuleHealth } from '../../search/rulesSearchParser';
import { alertStateToReadable } from '../../utils/rules';
import { HoverCard } from '../HoverCard';

import { MultipleDataSourcePicker } from './MultipleDataSourcePicker';

const ViewOptions: SelectableValue[] = [
  {
    icon: 'folder',
    label: 'Grouped',
    value: 'grouped',
  },
  {
    icon: 'list-ul',
    label: 'List',
    value: 'list',
  },
  {
    icon: 'heart-rate',
    label: 'State',
    value: 'state',
  },
];

const RuleTypeOptions: SelectableValue[] = [
  {
    label: 'Alert ',
    value: PromRuleType.Alerting,
  },
  {
    label: 'Recording ',
    value: PromRuleType.Recording,
  },
];

const RuleHealthOptions: SelectableValue[] = [
  { label: 'Ok', value: RuleHealth.Ok },
  { label: 'No Data', value: RuleHealth.NoData },
  { label: 'Error', value: RuleHealth.Error },
];

interface RulesFilerProps {
  onFilterCleared?: () => void;
}

const RuleStateOptions = Object.entries(PromAlertingRuleState).map(([key, value]) => ({
  label: alertStateToReadable(value),
  value,
}));

const RulesFilter = ({ onFilterCleared = () => undefined }: RulesFilerProps) => {
  const styles = useStyles2(getStyles);
  const [queryParams, setQueryParams] = useQueryParams();
  const { filterState, hasActiveFilters, searchQuery, setSearchQuery, updateFilters } = useRulesFilter();

  // This key is used to force a rerender on the inputs when the filters are cleared
  const [filterKey, setFilterKey] = useState<number>(Math.floor(Math.random() * 100));
  const dataSourceKey = `dataSource-${filterKey}`;
  const queryStringKey = `queryString-${filterKey}`;

  const searchQueryRef = useRef<HTMLInputElement | null>(null);
  const { handleSubmit, register, setValue } = useForm<{ searchQuery: string }>({ defaultValues: { searchQuery } });
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
  };

  const clearDataSource = () => {
    updateFilters({ ...filterState, dataSourceNames: [] });
    setFilterKey((key) => key + 1);
  };

  const handleAlertStateChange = (value: PromAlertingRuleState) => {
    logInfo(LogMessages.clickingAlertStateFilters);
    updateFilters({ ...filterState, ruleState: value });
    setFilterKey((key) => key + 1);
  };

  const handleViewChange = (view: string) => {
    setQueryParams({ view });
  };

  const handleRuleTypeChange = (ruleType: PromRuleType) => {
    updateFilters({ ...filterState, ruleType });
    setFilterKey((key) => key + 1);
  };

  const handleRuleHealthChange = (ruleHealth: RuleHealth) => {
    updateFilters({ ...filterState, ruleHealth });
    setFilterKey((key) => key + 1);
  };

  const handleClearFiltersClick = () => {
    setSearchQuery(undefined);
    onFilterCleared();

    setTimeout(() => setFilterKey(filterKey + 1), 100);
  };

  const searchIcon = <Icon name={'search'} />;
  return (
    <div className={styles.container}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1}>
          <Field
            className={styles.dsPickerContainer}
            label={
              <Label htmlFor="data-source-picker">
                <Stack gap={0.5}>
                  <span>Search by data sources</span>
                  <Tooltip
                    content={
                      <div>
                        <p>
                          Data sources containing configured alert rules are Mimir or Loki data sources where alert
                          rules are stored and evaluated in the data source itself.
                        </p>
                        <p>
                          In these data sources, you can select Manage alerts via Alerting UI to be able to manage these
                          alert rules in the Grafana UI as well as in the data source where they were configured.
                        </p>
                      </div>
                    }
                  >
                    <Icon name="info-circle" size="sm" />
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
        </Stack>
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={1}>
            <form
              className={styles.searchInput}
              onSubmit={handleSubmit((data) => {
                setSearchQuery(data.searchQuery);
                searchQueryRef.current?.blur();
              })}
            >
              <Field
                label={
                  <Label htmlFor="rulesSearchInput">
                    <Stack gap={0.5}>
                      <span>Search</span>
                      <HoverCard content={<SearchQueryHelp />}>
                        <Icon name="info-circle" size="sm" tabIndex={0} />
                      </HoverCard>
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
              <RadioButtonGroup
                options={ViewOptions}
                value={String(queryParams['view'] ?? ViewOptions[0].value)}
                onChange={handleViewChange}
              />
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
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    dsPickerContainer: css`
      width: 550px;
      flex-grow: 0;
      margin: 0;
    `,
    searchInput: css`
      flex: 1;
      margin: 0;
    `,
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
  grid: css`
    display: grid;
    grid-template-columns: max-content auto;
    gap: ${theme.spacing(1)};
    align-items: center;
  `,
  code: css`
    display: block;
    text-align: center;
  `,
});

export default RulesFilter;
