import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, ReactUtils, useStyles2 } from '@grafana/ui';

export interface Props {
  onRowToggle: () => void;
  isContentVisible?: boolean;
  title?: string;
  headerElement?: React.ReactNode | ((props: { className?: string }) => React.ReactNode);
}

export function SettingsBarHeader({ headerElement, isContentVisible = false, onRowToggle, title, ...rest }: Props) {
  const styles = useStyles2(getStyles);

  const headerElementRendered =
    headerElement && ReactUtils.renderOrCallToRender(headerElement, { className: styles.summaryWrapper });

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <IconButton
          name={isContentVisible ? 'angle-down' : 'angle-right'}
          tooltip={
            isContentVisible
              ? t('public-dashboard.settings-bar-header.collapse-settings-tooltip', 'Collapse settings')
              : t('public-dashboard.settings-bar-header.expand-settings-tooltip', 'Expand settings')
          }
          className={styles.collapseIcon}
          onClick={onRowToggle}
          aria-expanded={isContentVisible}
          {...rest}
        />
        {title && (
          // disabling the a11y rules here as the IconButton above handles keyboard interactions
          // this is just to provide a better experience for mouse users
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div className={styles.titleWrapper} onClick={onRowToggle}>
            <span className={styles.title}>{title}</span>
          </div>
        )}
        {headerElementRendered}
      </div>
    </div>
  );
}

SettingsBarHeader.displayName = 'SettingsBarHeader';

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      label: 'header',
      padding: theme.spacing(0.5, 0.5),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      minHeight: theme.spacing(4),

      '&:focus': {
        outline: 'none',
      },
    }),
    header: css({
      label: 'column',
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
    }),
    collapseIcon: css({
      marginLeft: theme.spacing(0.5),
      color: theme.colors.text.disabled,
    }),
    titleWrapper: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      overflow: 'hidden',
      marginRight: `${theme.spacing(0.5)}`,
      [theme.breakpoints.down('sm')]: {
        flex: '1 1',
      },
    }),
    title: css({
      fontWeight: theme.typography.fontWeightBold,
      marginLeft: theme.spacing(0.5),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    summaryWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      [theme.breakpoints.down('sm')]: {
        flex: '2 2',
      },
    }),
  };
}
