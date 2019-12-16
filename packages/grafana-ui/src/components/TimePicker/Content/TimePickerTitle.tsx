import React, { memo, PropsWithChildren, FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, stylesFactory } from '../../../themes';

const getStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    text: css`
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.formLabel};
    `,
  };
});

const TimePickerTitle: FC<PropsWithChildren<{}>> = ({ children }) => {
  const theme = useTheme();
  const styles = getStyle(theme);

  return <span className={styles.text}>{children}</span>;
};

export default memo(TimePickerTitle);
