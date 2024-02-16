import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { IconButton, useStyles2 } from '@grafana/ui/';

export interface ExpandedScopeSelectorProps {
  dashboards: any[];
  options: Array<SelectableValue<string>>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onToggle: () => void;
}

export const ExpandedScopeSelector = ({ options, value, onChange, onToggle }: ExpandedScopeSelectorProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.topContainer}>
        <IconButton name="arrow-to-right" aria-label="Collapse scope selector" onClick={onToggle} />
        <Select options={options} value={value} onChange={({ value }) => onChange(value)} />
      </div>
      <div className={styles.bottomContainer}></div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      backgroundColor: theme.colors.background.primary,
      flex: theme.spacing(40),
      gap: theme.spacing(1),
    }),
    topContainer: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'row',
      padding: theme.spacing(2),
    }),
    bottomContainer: css({
      padding: theme.spacing(2),
    }),
  };
};
