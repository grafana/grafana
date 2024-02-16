import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { IconButton, Select, useStyles2 } from '@grafana/ui';

export interface MinimizedScopeSelectorProps {
  options: Array<SelectableValue<string>>;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onToggle: () => void;
}

export const MinimizedScopeSelector = ({ options, value, onChange, onToggle }: MinimizedScopeSelectorProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <IconButton name="arrow-to-right" aria-label="Collapse scope selector" onClick={onToggle} />
      <Select options={options} value={value} onChange={({ value }) => onChange(value)} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flex: theme.spacing(40),
      flexDirection: 'row',
      gap: theme.spacing(1),
    }),
  };
};
