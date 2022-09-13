import { css, cx } from '@emotion/css';
import React, { HTMLProps } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { stylesFactory, useTheme2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';

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
  /** Extra content, displayed after the tab label and counter */
  suffix?: NavModelItem['tabSuffix'];
}

export const Tab = React.forwardRef<HTMLAnchorElement, TabProps>(
  ({ label, active, icon, onChangeTab, counter, suffix: Suffix, className, href, ...otherProps }, ref) => {
    const theme = useTheme2();
    const tabsStyles = getTabStyles(theme);
    const content = () => (
      <>
        {icon && <Icon name={icon} />}
        {label}
        {typeof counter === 'number' && <Counter value={counter} />}
        {Suffix && <Suffix className={tabsStyles.suffix} />}
      </>
    );

    const linkClass = cx(tabsStyles.link, active ? tabsStyles.activeStyle : tabsStyles.notActive);

    return (
      <div className={tabsStyles.item}>
        <a
          // in case there is no href '#' is set in order to maintain a11y
          href={href ? href : '#'}
          className={linkClass}
          {...otherProps}
          onClick={onChangeTab}
          aria-label={otherProps['aria-label'] || selectors.components.Tab.title(label)}
          role="tab"
          aria-selected={active}
          ref={ref}
        >
          {content()}
        </a>
      </div>
    );
  }
);

Tab.displayName = 'Tab';

const getTabStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    item: css`
      list-style: none;
      position: relative;
      display: flex;
    `,
    link: css`
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(1.5, 2, 1)};
      display: block;
      height: 100%;
      svg {
        margin-right: ${theme.spacing(1)};
      }

      &:focus-visible {
+        ${getFocusStyles(theme)}
      }
    `,
    notActive: css`
      a:hover,
      &:hover,
      &:focus {
        color: ${theme.colors.text.primary};

        &::before {
          display: block;
          content: ' ';
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          border-radius: 2px;
          bottom: 0px;
          background: ${theme.colors.action.hover};
        }
      }
    `,
    activeStyle: css`
      label: activeTabStyle;
      color: ${theme.colors.text.primary};
      overflow: hidden;
      font-weight: ${theme.typography.fontWeightMedium};

      a {
        color: ${theme.colors.text.primary};
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
        background-image: ${theme.colors.gradients.brandHorizontal} !important;
      }
    `,
    suffix: css`
      margin-left: ${theme.spacing(1)};
    `,
  };
});
