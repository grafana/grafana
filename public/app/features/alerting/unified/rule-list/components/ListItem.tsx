import { css } from '@emotion/css';
import React, { ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';

interface ListItemProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode[];
  metaRight?: ReactNode[];
  actions?: ReactNode;
  'data-testid'?: string;
}

export const ListItem = (props: ListItemProps) => {
  const styles = useStyles2(getStyles);
  const { icon = null, title, description, meta, metaRight, actions, 'data-testid': testId } = props;

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false" data-testid={testId}>
      <Stack direction="row" alignItems="start" gap={1} wrap={false}>
        {/* icon */}
        {icon}

        <Stack direction="column" gap={0} flex="1" minWidth={0}>
          {/* title */}
          <Stack direction="column" gap={0}>
            <div className={styles.textOverflow}>{title}</div>
            <div className={styles.textOverflow}>{description}</div>
          </Stack>

          {/* metadata */}
          <Stack direction="row" gap={0.5} alignItems="center">
            {meta?.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <Separator />}
                {item}
              </React.Fragment>
            ))}
          </Stack>
        </Stack>

        {/* actions & meta right */}
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          {/* @TODO move this so the metadata row can extend beyond the width of this column */}
          {metaRight}
          {actions}
        </Stack>
      </Stack>
    </li>
  );
};

export const SkeletonListItem = () => {
  return (
    <ListItem
      icon={<Skeleton width={16} height={16} circle />}
      title={<Skeleton height={16} width={350} />}
      actions={<Skeleton height={10} width={200} />}
    />
  );
};

const Separator = () => (
  <Text color="secondary" variant="bodySmall">
    {'·'}
  </Text>
);

const getStyles = (theme: GrafanaTheme2) => ({
  alertListItemContainer: css({
    position: 'relative',
    listStyle: 'none',
    background: theme.colors.background.primary,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1)}`,
  }),
  textOverflow: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'inherit',
  }),
});
