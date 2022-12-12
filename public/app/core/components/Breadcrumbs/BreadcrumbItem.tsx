import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { Breadcrumb } from './types';

type Props = Breadcrumb & {
  isCurrent: boolean;
};

export function BreadcrumbItem(props: Props) {
  const styles = useStyles2(getStyles);
  return (
    <li className={styles.breadcrumbWrapper}>
      {props.isCurrent ? (
        <span className={styles.breadcrumb} aria-current="page">
          {props.text}
        </span>
      ) : (
        <>
          <a className={cx(styles.breadcrumb, styles.breadcrumbLink)} href={props.href}>
            {props.text}
          </a>
          <div className={styles.separator} aria-hidden={true}>
            <Icon name="angle-right" />
          </div>
        </>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const separator = css({
    color: theme.colors.text.secondary,
  });

  return {
    breadcrumb: css({
      display: 'block',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      padding: theme.spacing(0, 0.5),
      whiteSpace: 'nowrap',
      color: theme.colors.text.secondary,
    }),
    breadcrumbLink: css({
      color: theme.colors.text.primary,
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    breadcrumbWrapper: css({
      alignItems: 'center',
      color: theme.colors.text.primary,
      display: 'flex',
      flex: 1,
      minWidth: 0,
      maxWidth: 'max-content',

      // logic for small screens
      // hide any breadcrumbs that aren't the second to last child (the parent)
      // unless there's only one breadcrumb, in which case we show it
      [theme.breakpoints.down('md')]: {
        display: 'none',
        '&:nth-last-child(2)': {
          display: 'flex',
          flexDirection: 'row-reverse',

          [`.${separator}`]: {
            transform: 'rotate(180deg)',
          },
        },
        '&:first-child&:last-child': {
          display: 'flex',

          [`.${separator}`]: {
            display: 'none',
          },
        },
      },
    }),
    separator,
  };
};
