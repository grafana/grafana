import { css } from '@emotion/css';
import React, { memo, PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    text: css`
      font-size: ${theme.typography.size.md};
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.primary};
      margin: 0;
      display: flex;
    `,
  };
};

export const TimePickerTitle = memo<PropsWithChildren<{}>>(({ children }) => {
  const styles = useStyles2(getStyles);

  return <h3 className={styles.text}>{children}</h3>;
});

TimePickerTitle.displayName = 'TimePickerTitle';
