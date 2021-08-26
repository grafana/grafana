import React from 'react';
import { RadioButtonGroup, Label, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { css } from '@emotion/css';

interface Props {
  stateFilter?: AlertState;
  onStateFilterChange: (value: AlertState) => void;
}

export const AlertStateFilter = ({ onStateFilterChange, stateFilter }: Props) => {
  const styles = useStyles2(getStyles);
  const alertStateOptions: SelectableValue[] = Object.entries(AlertState)
    .sort(([labelA], [labelB]) => (labelA < labelB ? -1 : 1))
    .map(([label, state]) => ({
      label,
      value: state,
    }));

  return (
    <div className={styles.wrapper}>
      <Label>State</Label>
      <RadioButtonGroup options={alertStateOptions} value={stateFilter} onChange={onStateFilterChange} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin-left: ${theme.spacing(1)};
  `,
});
