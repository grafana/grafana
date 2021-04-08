import React, { FormEvent, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Button, Icon, Input, Label, RadioButtonGroup, useStyles } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { omitBy, isUndefined } from 'lodash';

import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import DataSourceSelect from '../DataSourceSelect';
import { rulesFiltersSlice } from '../../state/reducers';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';

const RulesFilter = () => {
  const dispatch = useDispatch();
  const [queryParams, setQueryParams] = useQueryParams();
  const { rulesFilters } = useUnifiedAlertingSelector((state) => state.filters);
  const { dataSource, alertState, queryString } = rulesFilters;
  const { setDataSource, setQueryString, setAlertState, clearFilters, replaceFilters } = rulesFiltersSlice.actions;
  const styles = useStyles(getStyles);
  const stateOptions = Object.entries(PromAlertingRuleState).map(([key, value]) => ({ label: key, value }));

  useEffect(() => {
    if (!Object.keys(rulesFilters).length && Object.keys(queryParams).length) {
      const queryString = queryParams['queryString'] as string | undefined;
      const alertState = queryParams['alertState'] as string | undefined;
      const dataSource = queryParams['dataSource'] as string | undefined;
      const filtersToSet = omitBy({ queryString, alertState, dataSource }, isUndefined);
      dispatch(replaceFilters({ ...filtersToSet }));
    }
  });

  const handleDataSourceChange = (dataSourceValue: SelectableValue<string>) => {
    dispatch(setDataSource(dataSourceValue.value as string));
    setQueryParams({ dataSource: dataSourceValue.value });
  };
  const handleQueryStringChange = (e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    dispatch(setQueryString(target.value));
    setQueryParams({ queryString: target.value });
  };
  const handleAlertStateChange = (value: string) => {
    dispatch(setAlertState(value));
    setQueryParams({ alertState: value });
  };

  const handleClearFiltersClick = () => {
    dispatch(clearFilters());
    setQueryParams({
      alertState: undefined,
      queryString: undefined,
      dataSource: undefined,
    });
  };

  const searchIcon = <Icon name={'search'} />;
  return (
    <div className={styles.container}>
      <div className={styles.inputWidth}>
        <Label>Select data source</Label>
        <DataSourceSelect key={dataSource} value={dataSource} onChange={handleDataSourceChange} />
      </div>
      <div className={cx(styles.flexRow, styles.spaceBetween)}>
        <div className={styles.flexRow}>
          <div className={styles.rowChild}>
            <Label>Search by name or label</Label>
            <Input
              className={styles.inputWidth}
              prefix={searchIcon}
              onChange={handleQueryStringChange}
              value={queryString}
            />
          </div>
          <div className={styles.rowChild}>
            <RadioButtonGroup options={stateOptions} value={alertState} onChange={handleAlertStateChange} />
          </div>
        </div>
        {(dataSource || alertState || queryString) && (
          <div className={styles.flexRow}>
            <Button fullWidth={false} icon="times" variant="secondary" onClick={handleClearFiltersClick}>
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
      margin-bottom: ${theme.spacing.sm};

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
    `,
    spaceBetween: css`
      justify-content: space-between;
    `,
    rowChild: css`
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
    clearButton: css`
      align-self: flex-end;
    `,
  };
};

export default RulesFilter;
