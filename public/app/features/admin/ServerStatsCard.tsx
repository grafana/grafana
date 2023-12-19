import { css, cx } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { CardContainer, useStyles2, Tooltip, Icon } from '@grafana/ui';

interface StatItem {
  name: string;
  value: string | number | undefined;
  tooltip?: string;
  highlight?: boolean;
  indent?: boolean;
}

export interface Props {
  content: StatItem[];
  isLoading?: boolean;
  footer?: JSX.Element | boolean;
}

export const ServerStatsCard = ({ content, footer, isLoading }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <CardContainer className={styles.container} disableHover>
      {content.map((item, index) => (
        <div key={index} className={styles.inner}>
          <span className={cx({ [styles.indent]: !!item.indent })}>{item.name}</span>
          {item.tooltip && (
            <Tooltip content={String(item.tooltip)} placement="auto-start">
              <Icon name="info-circle" className={styles.tooltip} />
            </Tooltip>
          )}
          {isLoading ? (
            <Skeleton width={60} />
          ) : (
            <span className={item.highlight ? styles.highlight : ''}>{item.value}</span>
          )}
        </div>
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
    inner: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    indent: css({
      marginLeft: theme.spacing(2),
    }),
    tooltip: css({
      color: theme.colors.secondary.text,
    }),
    highlight: css({
      color: theme.colors.warning.text,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      marginRight: `-${theme.spacing(1)}`,
    }),
  };
};
