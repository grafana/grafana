import { css, cx } from '@emotion/css';
import { HTMLProps } from 'react';
import * as React from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types/icon';
import { clearButtonStyles } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

import { Counter } from './Counter';

export interface TabProps extends HTMLProps<HTMLElement> {
  label: string;
  active?: boolean;
  /** When provided, it is possible to use the tab as a hyperlink. Use in cases where the tabs update location. */
  href?: string;
  icon?: IconName;
  onChangeTab?: (event: React.MouseEvent<HTMLElement>) => void;
  /** A number rendered next to the text. Usually used to display the number of items in a tab's view. */
  counter?: number | null;
  /** Extra content, displayed after the tab label and counter */
  suffix?: NavModelItem['tabSuffix'];
  truncate?: boolean;
  tooltip?: string;
  /** When true, the tab will be disabled and not clickable */
  disabled?: boolean;
}

export const Tab = React.forwardRef<HTMLElement, TabProps>(
  (
    {
      label,
      active,
      icon,
      onChangeTab,
      counter,
      suffix: Suffix,
      className,
      href,
      truncate,
      tooltip,
      disabled,
      ...otherProps
    },
    ref
  ) => {
    const tabsStyles = useStyles2(getStyles);
    const clearStyles = useStyles2(clearButtonStyles);

    const content = () => (
      <>
        {icon && <Icon name={icon} data-testid={`tab-icon-${icon}`} />}
        {label}
        {typeof counter === 'number' && <Counter value={counter} />}
        {Suffix && <Suffix className={tabsStyles.suffix} />}
      </>
    );

    const linkClass = cx(
      clearStyles,
      tabsStyles.link,
      active ? tabsStyles.activeStyle : tabsStyles.notActive,
      truncate && tabsStyles.linkTruncate,
      disabled && tabsStyles.disabled
    );

    const commonProps = {
      className: linkClass,
      'data-testid': selectors.components.Tab.title(label),
      ...otherProps,
      onClick: disabled ? undefined : onChangeTab,
      role: 'tab',
      'aria-selected': active,
      'aria-disabled': disabled,
      title: !!tooltip ? undefined : otherProps.title, // If tooltip is provided, don't set the title on the link or button, it looks weird
    };

    let tab = null;

    if (href) {
      tab = (
        <div className={cx(tabsStyles.item, truncate && tabsStyles.itemTruncate, className)}>
          <a
            {...commonProps}
            href={href}
            // don't think we can avoid the type assertion here :(
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          >
            {content()}
          </a>
        </div>
      );
    } else {
      tab = (
        <div className={cx(tabsStyles.item, truncate && tabsStyles.itemTruncate, className)}>
          <button
            {...commonProps}
            type="button"
            // don't think we can avoid the type assertion here :(
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ref={ref as React.ForwardedRef<HTMLButtonElement>}
          >
            {content()}
          </button>
        </div>
      );
    }

    if (tooltip) {
      return <Tooltip content={tooltip}>{tab}</Tooltip>;
    }

    return tab;
  }
);

Tab.displayName = 'Tab';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    item: css({
      listStyle: 'none',
      position: 'relative',
      display: 'flex',
      whiteSpace: 'nowrap',
      padding: theme.spacing(0, 0.5),
    }),
    itemTruncate: css({
      maxWidth: theme.spacing(40),
    }),
    link: css({
      color: theme.colors.text.secondary,
      padding: theme.spacing(1, 1.5, 1),
      borderRadius: theme.shape.radius.default,

      display: 'block',
      height: '100%',

      svg: {
        marginRight: theme.spacing(1),
      },

      '&:focus-visible': getFocusStyles(theme),

      '&::before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        left: 0,
        right: 0,
        height: '2px',
        borderRadius: theme.shape.radius.default,
        bottom: 0,
      },
    }),
    linkTruncate: css({
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      wordBreak: 'break-word',
      overflow: 'hidden',
    }),
    notActive: css({
      'a:hover, &:hover, &:focus': {
        color: theme.colors.text.primary,

        '&::before': {
          backgroundColor: theme.colors.action.hover,
        },
      },
    }),
    activeStyle: css({
      label: 'activeTabStyle',
      color: theme.colors.text.primary,
      overflow: 'hidden',

      '&::before': {
        backgroundImage: theme.colors.gradients.brandHorizontal,
      },
    }),
    suffix: css({
      marginLeft: theme.spacing(1),
    }),
    disabled: css({
      color: theme.colors.text.disabled,
      cursor: 'not-allowed',
      boxShadow: 'none',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'none',
      },

      '&:hover, &:focus': {
        color: theme.colors.text.disabled,
        cursor: 'not-allowed',
        boxShadow: 'none',

        '&::before': {
          backgroundColor: 'transparent',
        },
      },
    }),
  };
};
