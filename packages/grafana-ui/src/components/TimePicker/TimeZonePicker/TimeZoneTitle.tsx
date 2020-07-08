import React, { ReactNode } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, stylesFactory } from '../../../themes';

interface Props {
  title: string | ReactNode;
}

export const TimeZoneTitle: React.FC<Props> = ({ title }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (!title) {
    return null;
  }

  return <span className={styles.title}>{title}</span>;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    title: css`
      font-weight: ${theme.typography.weight.regular};
      text-overflow: ellipsis;
    `,
  };
});
