import React, { FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { Icon, Input, Label, RadioButtonGroup, useStyles } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { css } from 'emotion';

import DataSourceSelect from '../DataSourceSelect';
import { rulesFiltersSlice } from '../../state/reducers';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';

const RulesFilter = () => {
  const dispatch = useDispatch();
  const { rulesFilters } = useUnifiedAlertingSelector((state) => state.filters);
  const { dataSource, alertState } = rulesFilters;
  const { setDataSource, setQueryString, setAlertState } = rulesFiltersSlice.actions;
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
        <DataSourceSelect value={dataSource} onChange={handleDataSourceChange} />
      </div>
      <div className={styles.flexRow}>
        <div>
          <Label>Search by name or label</Label>
          <Input className={styles.inputWidth} prefix={searchIcon} onChange={handleQueryStringChange} />
        </div>
        <RadioButtonGroup
          options={stateOptions}
          value={alertState}
          onChange={(value: string) => {
            dispatch(setAlertState(value));
          }}
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
    `,
    inputWidth: css`
      width: 340px;
      flex-grow: 0;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-end;
    `,
  };
};

export default RulesFilter;
