import React, { FormEvent, useState } from 'react';
import { Button, Icon, Input, Label, RadioButtonGroup, Tooltip, useStyles } from '@grafana/ui';
import { DataSourceInstanceSettings, GrafanaTheme, SelectableValue } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { debounce } from 'lodash';

import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { DataSourcePicker } from '@grafana/runtime';
import { alertStateToReadable } from '../../utils/rules';

const ViewOptions: SelectableValue[] = [
  {
    icon: 'folder',
    label: 'Groups',
    value: 'group',
  },
  {
    icon: 'heart-rate',
    label: 'State',
    value: 'state',
  },
];

const RulesFilter = () => {
  const [queryParams, setQueryParams] = useQueryParams();
  // This key is used to force a rerender on the inputs when the filters are cleared
  const [filterKey, setFilterKey] = useState<number>(Math.floor(Math.random() * 100));
  const dataSourceKey = `dataSource-${filterKey}`;
  const queryStringKey = `queryString-${filterKey}`;

  const { dataSource, alertState, queryString } = getFiltersFromUrlParams(queryParams);

  const styles = useStyles(getStyles);
  const stateOptions = Object.entries(PromAlertingRuleState).map(([key, value]) => ({
    label: alertStateToReadable(value),
    value,
  }));

  const handleDataSourceChange = (dataSourceValue: DataSourceInstanceSettings) => {
    setQueryParams({ dataSource: dataSourceValue.name });
  };

  const handleQueryStringChange = debounce((e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    setQueryParams({ queryString: target.value || null });
  }, 600);

  const handleAlertStateChange = (value: string) => {
    setQueryParams({ alertState: value });
  };

  const handleViewChange = (view: string) => {
    setQueryParams({ view });
  };

  const handleClearFiltersClick = () => {
    setQueryParams({
      alertState: null,
      queryString: null,
      dataSource: null,
    });
    setFilterKey(filterKey + 1);
  };

  const searchIcon = <Icon name={'search'} />;
  return (
    <div className={styles.container}>
      <div className={styles.inputWidth}>
        <Label>Select data source</Label>
        <DataSourcePicker
          key={dataSourceKey}
          alerting
          noDefault
          current={dataSource}
          onChange={handleDataSourceChange}
        />
      </div>
      <div className={cx(styles.flexRow, styles.spaceBetween)}>
        <div className={styles.flexRow}>
          <div className={styles.rowChild}>
            <Label>
              <Tooltip
                content={
                  <div>
                    Filter rules and alerts using label querying, ex:
                    <pre>{`{severity="critical", instance=~"cluster-us-.+"}`}</pre>
                  </div>
                }
              >
                <Icon name="info-circle" className={styles.tooltip} />
              </Tooltip>
              Search by label
            </Label>
            <Input
              key={queryStringKey}
              className={styles.inputWidth}
              prefix={searchIcon}
              onChange={handleQueryStringChange}
              defaultValue={queryString}
              placeholder="Search"
              data-testid="search-query-input"
            />
          </div>
          <div className={styles.rowChild}>
            <Label>State</Label>
            <RadioButtonGroup options={stateOptions} value={alertState} onChange={handleAlertStateChange} />
          </div>
          <div className={styles.rowChild}>
            <Label>View as</Label>
            <RadioButtonGroup
              options={ViewOptions}
              value={String(queryParams['view'] || 'group')}
              onChange={handleViewChange}
            />
          </div>
        </div>
        {(dataSource || alertState || queryString) && (
          <div className={styles.flexRow}>
            <Button
              className={styles.clearButton}
              fullWidth={false}
              icon="times"
              variant="secondary"
              onClick={handleClearFiltersClick}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid ${theme.colors.border1};
      padding-bottom: ${theme.spacing.sm};

      & > div {
        margin-bottom: ${theme.spacing.sm};
      }
    `,
    inputWidth: css`
      width: 340px;
      flex-grow: 0;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      width: 100%;
      flex-wrap: wrap;
    `,
    spaceBetween: css`
      justify-content: space-between;
    `,
    rowChild: css`
      margin-right: ${theme.spacing.sm};
      margin-top: ${theme.spacing.sm};
    `,
    tooltip: css`
      margin: 0 ${theme.spacing.xs};
    `,
    clearButton: css`
      margin-top: ${theme.spacing.sm};
    `,
  };
};

export default RulesFilter;
