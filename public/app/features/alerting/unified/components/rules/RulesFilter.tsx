import React, { FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { Button, Icon, Input, Label, RadioButtonGroup, useStyles } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';

import DataSourceSelect from '../DataSourceSelect';
import { rulesFiltersSlice } from '../../state/reducers';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';

const RulesFilter = () => {
  const dispatch = useDispatch();
  const { rulesFilters } = useUnifiedAlertingSelector((state) => state.filters);
  const { dataSource, alertState, queryString } = rulesFilters;
  const { setDataSource, setQueryString, setAlertState, clearFilters } = rulesFiltersSlice.actions;
  const styles = useStyles(getStyles);
  const stateOptions = [
    { label: 'Firing', value: 'firing' },
    { label: 'Pending', value: 'pending' },
    { label: 'Silenced', value: 'silenced' },
  ];
  const handleDataSourceChange = (dataSourceValue: SelectableValue<string>) => {
    dispatch(setDataSource(dataSourceValue.value as string));
  };
  const handleQueryStringChange = (e: FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    dispatch(setQueryString(target.value));
  };
  const searchIcon = <Icon name={'search'} />;
  return (
    <div className={styles.container}>
      <div className={styles.inputWidth}>
        <Label>Select data source</Label>
        <DataSourceSelect key={dataSource} value={dataSource} onChange={handleDataSourceChange} />
      </div>
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
          <RadioButtonGroup
            options={stateOptions}
            value={alertState}
            onChange={(value: string) => {
              dispatch(setAlertState(value));
            }}
          />
        </div>
      </div>
      {(dataSource || alertState || queryString) && (
        <div className={styles.clearButton}>
          <Button fullWidth={false} icon="times" variant="secondary" onClick={() => dispatch(clearFilters())}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;

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
      justify-content: flex;
      align-items: flex-end;
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
