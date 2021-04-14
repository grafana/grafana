import React, { HTMLProps } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';
import { stylesFactory, useTheme } from '../../themes';
import { Counter } from './Counter';

export interface TabProps extends HTMLProps<HTMLLIElement> {
  label: string;
  active?: boolean;
  /** When provided, it is possible to use the tab as a hyperlink. Use in cases where the tabs update location. */
  href?: string;
  icon?: IconName;
  onChangeTab?: (event?: React.MouseEvent<HTMLLIElement>) => void;
  /** A number rendered next to the text. Usually used to display the number of items in a tab's view. */
  counter?: number | null;
}

export const Tab = React.forwardRef<HTMLLIElement, TabProps>(
  ({ label, active, icon, onChangeTab, counter, className, href, ...otherProps }, ref) => {
    const theme = useTheme();
    const tabsStyles = getTabStyles(theme);
    const content = () => (
      <>
        {icon && <Icon name={icon} />}
        {label}
        {typeof counter === 'number' && <Counter value={counter} />}
      </>
    );

    return (
      <li
        {...otherProps}
        className={cx(!href && tabsStyles.padding, tabsStyles.tabItem, active && tabsStyles.activeStyle)}
        onClick={onChangeTab}
        aria-label={otherProps['aria-label'] || selectors.components.Tab.title(label)}
        ref={ref}
      >
        {href ? (
          <a href={href} className={tabsStyles.padding}>
            {content()}
          </a>
        ) : (
          <>{content()}</>
        )}
      </li>
    );
  }
);

Tab.displayName = 'Tab';

const getTabStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    tabItem: css`
      list-style: none;
      margin-right: ${theme.v2.spacing(2)};
      position: relative;
      display: block;
      color: ${theme.v2.palette.text.secondary};
      cursor: pointer;

      svg {
        margin-right: ${theme.v2.spacing(1)};
      }

      a {
        display: block;
        height: 100%;
        color: ${theme.v2.palette.text.secondary};
      }

      a:hover,
      &:hover,
      &:focus {
        color: ${theme.v2.palette.text.primary};
      }
    `,
    padding: css`
      padding: 11px 15px 9px;
    `,
    activeStyle: css`
      label: activeTabStyle;
      color: ${theme.v2.palette.text.primary};
      overflow: hidden;
      font-weight: ${theme.v2.typography.fontWeightMedium};

      a {
        color: ${theme.v2.palette.text.primary};
      }

      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: 0;
        right: 0;
        height: 4px;
        border-radius: 2px;
        bottom: 2px;
        background-image: ${theme.v2.palette.gradients.brandHorizontal};
      }
    `,
  };
});
