import React, { memo, PropsWithChildren } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, stylesFactory } from '../../../themes';

const getStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    text: css`
      font-size: ${theme.typography.size.md};
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.formLabel};
      margin: 0;
      display: flex;
    `,
  };
});

export const TimePickerTitle = memo<PropsWithChildren<{}>>(({ children }) => {
  const theme = useTheme();
  const styles = getStyle(theme);

  return <h3 className={styles.text}>{children}</h3>;
});

TimePickerTitle.displayName = 'TimePickerTitle';
