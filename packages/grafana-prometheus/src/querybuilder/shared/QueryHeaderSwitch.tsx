// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/shared/QueryHeaderSwitch.tsx
import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import { HTMLProps, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Switch, useStyles2, Stack } from '@grafana/ui';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'value' | 'ref'> {
  value?: boolean;
  label: string;
}

export function QueryHeaderSwitch({ label, ...inputProps }: Props) {
  const dashedLabel = label.replace(' ', '-');
  const switchIdRef = useRef(uniqueId(`switch-${dashedLabel}`));
  const styles = useStyles2(getStyles);

  return (
    <Stack gap={1}>
      <label htmlFor={switchIdRef.current} className={styles.switchLabel}>
        {label}
      </label>
      <Switch {...inputProps} id={switchIdRef.current} />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    switchLabel: css({
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};
