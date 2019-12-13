import React, { memo } from 'react';
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

interface Props {
  children: string;
}

const TimePickerTitle: React.FC<Props> = ({ children }) => {
  const theme = useTheme();
  const styles = getStyle(theme);

  return <span className={styles.text}>{children}</span>;
};

export default memo(TimePickerTitle);
