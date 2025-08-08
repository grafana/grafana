import { css } from '@emotion/css';
import React, { AriaAttributes, ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';

interface ListItemProps extends AriaAttributes {
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
  const { icon = null, title, description, meta, metaRight, actions, 'data-testid': testId, ...ariaAttributes } = props;

  return (
    <li
      className={styles.alertListItemContainer}
      role="treeitem"
      aria-selected="false"
      data-testid={testId}
      {...ariaAttributes}
    >
      <Stack direction="row" alignItems="start" gap={1} wrap={false}>
        {/* icon */}
        <span className={styles.statusIcon}>{icon}</span>

        <Stack direction="column" gap={0} flex="1" minWidth={0}>
          {/* title */}
          <Stack direction="column" gap={0}>
            <div className={styles.textOverflow}>{title}</div>
            <div className={styles.textOverflow}>{description}</div>
          </Stack>

          {/* metadata */}
          <Stack direction="row" gap={1} alignItems="center">
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
    {'|'}
  </Text>
);

const getStyles = (theme: GrafanaTheme2) => ({
  alertListItemContainer: css({
    position: 'relative',
    listStyle: 'none',

    padding: theme.spacing(1),

    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  textOverflow: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'inherit',
  }),
  // this will line up the icon with the title of the rule
  statusIcon: css({
    marginTop: theme.spacing(0.5),
  }),
});
