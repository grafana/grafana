import { css, cx } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Icon, Stack, Tooltip, useStyles2 } from '@grafana/ui';

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
    <Card noMargin className={styles.container}>
      {content.map((item, index) => (
        <Stack key={index} justifyContent="space-between" alignItems="center">
          <Stack alignItems={'center'}>
            <span className={cx({ [styles.indent]: !!item.indent })}>{item.name}</span>
            {item.tooltip && (
              <Tooltip content={String(item.tooltip)} placement="auto-start">
                <Icon name="info-circle" className={styles.tooltip} />
              </Tooltip>
            )}
          </Stack>
          {isLoading ? (
            <Skeleton width={60} />
          ) : (
            <span className={item.highlight ? styles.highlight : ''}>{item.value}</span>
          )}
        </Stack>
      ))}
      {footer && <div>{footer}</div>}
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      margin: 0,
      padding: theme.spacing(2),
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
