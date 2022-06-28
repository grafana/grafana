import { css, cx } from '@emotion/css';
import React, { HTMLProps } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';

import { Counter } from './Counter';

export interface TabProps extends HTMLProps<HTMLLIElement> {
  label: string;
  active?: boolean;
  /** When provided, it is possible to use the tab as a hyperlink. Use in cases where the tabs update location. */
  href?: string;
  icon?: IconName;
  /** A number rendered next to the text. Usually used to display the number of items in a tab's view. */
  counter?: number | null;
}

export const VerticalTab = React.forwardRef<HTMLLIElement, TabProps>(
  ({ label, active, icon, counter, className, href, ...otherProps }, ref) => {
    const tabsStyles = useStyles2(getTabStyles);
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

VerticalTab.displayName = 'Tab';

const getTabStyles = (theme: GrafanaTheme2) => {
  return {
    tabItem: css`
      list-style: none;
      margin-right: ${theme.spacing(2)};
      position: relative;
      display: block;
      color: ${theme.colors.text.primary};
      cursor: pointer;
      margin-bottom: 4px;

      svg {
        margin-right: ${theme.spacing(1)};
      }

      a {
        display: block;
        height: 100%;
      }

      &:hover,
      &:focus {
        a {
          text-decoration: underline;
        }
      }
    `,
    padding: css`
      padding: 6px 12px;
    `,
    activeStyle: css`
      label: activeTabStyle;
      color: ${theme.colors.text.maxContrast};
      font-weight: 500;
      overflow: hidden;

      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: 0;
        width: 4px;
        bottom: 0;
        top: 0;
        border-radius: 2px;
        background-image: linear-gradient(0deg, #f05a28 30%, #fbca0a 99%);
      }
    `,
  };
};
