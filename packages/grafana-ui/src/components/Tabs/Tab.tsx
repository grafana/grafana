import React, { HTMLProps } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';
import { stylesFactory, useTheme } from '../../themes';
import { Counter } from './Counter';

export interface TabProps extends HTMLProps<HTMLAnchorElement> {
  label: string;
  active?: boolean;
  /** When provided, it is possible to use the tab as a hyperlink. Use in cases where the tabs update location. */
  href?: string;
  icon?: IconName;
  onChangeTab?: (event?: React.MouseEvent<HTMLAnchorElement>) => void;
  /** A number rendered next to the text. Usually used to display the number of items in a tab's view. */
  counter?: number | null;
}

export const Tab = React.forwardRef<HTMLAnchorElement, TabProps>(
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

    const linkClass = cx(tabsStyles.link, active ? tabsStyles.activeStyle : tabsStyles.notActive);

    return (
      <li className={tabsStyles.item}>
        <a
          href={href}
          className={linkClass}
          {...otherProps}
          onClick={onChangeTab}
          aria-label={otherProps['aria-label'] || selectors.components.Tab.title(label)}
          ref={ref}
        >
          {content()}
        </a>
      </li>
    );
  }
);

Tab.displayName = 'Tab';

const getTabStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    item: css`
      list-style: none;
      position: relative;
      display: flex;
    `,
    link: css`
      color: ${theme.v2.palette.text.secondary};
      padding: ${theme.v2.spacing(1.5, 2, 1)};

      svg {
        margin-right: ${theme.v2.spacing(1)};
      }

      a {
        display: block;
        height: 100%;
        color: ${theme.v2.palette.text.secondary};
      }
    `,
    notActive: css`
      a:hover,
      &:hover,
      &:focus {
        color: ${theme.v2.palette.text.primary};

        &::before {
          display: block;
          content: ' ';
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          border-radius: 2px;
          bottom: 0px;
          background: ${theme.v2.palette.action.hover};
        }
      }
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
        bottom: 0px;
        background-image: ${theme.v2.palette.gradients.brandHorizontal} !important;
      }
    `,
  };
});
