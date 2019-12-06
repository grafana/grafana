import React, { memo } from 'react';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

interface Props {
  children: string;
}

const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    text: css`
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.formLabel};
    `,
  };
});

const TimeRangeTitle: React.FC<Props> = ({ children }) => {
  const theme = useTheme();
  const styles = getLabelStyles(theme);

  return <span className={styles.text}>{children}</span>;
};

export default memo(TimeRangeTitle);
