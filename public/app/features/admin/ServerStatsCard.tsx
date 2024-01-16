import { css } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { CardContainer, Stack, useStyles2 } from '@grafana/ui';

export interface Props {
  content: Array<Record<string, string | number | undefined>>;
  isLoading?: boolean;
  footer?: JSX.Element | boolean;
}

export const ServerStatsCard = ({ content, footer, isLoading }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <CardContainer className={styles.container} disableHover>
      {content.map((item, index) => (
        <Stack key={index} justifyContent="space-between" alignItems="center">
          <span>{item.name}</span>
          {isLoading ? <Skeleton width={60} /> : <span>{item.value}</span>}
        </Stack>
      ))}
      {footer && <div>{footer}</div>}
    </CardContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(2),
    }),
  };
};
