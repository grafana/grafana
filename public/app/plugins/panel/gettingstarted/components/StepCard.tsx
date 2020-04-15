import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme } from '@grafana/ui';
import { css } from 'emotion';

interface Props {}

export const StepCard: FC<Props> = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return <div className={styles.card}></div>;
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    card: css`
      min-width: 230px;
    `,
  };
});
