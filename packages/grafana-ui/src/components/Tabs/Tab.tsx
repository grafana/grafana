import React, { HTMLProps, RefObject } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';
import { stylesFactory, useTheme2 } from '../../themes';
import { Counter } from './Counter';
import { getFocusStyles } from '../../themes/mixins';
import { Node } from '@react-types/shared';
import { TabListState } from '@react-stately/tabs';
import { useTab } from '@react-aria/tabs';

export interface TabProps extends HTMLProps<HTMLAnchorElement> {
  label: string | undefined;
  active?: boolean;
  /** When provided, it is possible to use the tab as a hyperlink. Use in cases where the tabs update location. */
  href?: string;
  icon?: IconName;
  onChangeTab?: (event?: React.MouseEvent<HTMLAnchorElement>) => void;
  /** A number rendered next to the text. Usually used to display the number of items in a tab's view. */
  counter?: number | null;
  item?: any;
  state?: TabListState<{}>;
}

export const Tab = React.forwardRef<HTMLAnchorElement, TabProps>(
  ({ item, state, label, active, icon, counter, className, href, ...otherProps }, ref) => {
    const theme = useTheme2();
    const tabsStyles = getTabStyles(theme);
    const mainTabRef = React.useRef(null);
    const { key } = item;
    const { tabProps } = useTab({ key }, state!, mainTabRef as RefObject<HTMLElement>);
    const isSelected = state?.selectedKey === key;

    const content = () => (
      <>
        {icon && <Icon name={icon} />}
        {label}
        {typeof counter === 'number' && <Counter value={counter} />}
      </>
    );

    const linkClass = cx(tabsStyles.link, isSelected ? tabsStyles.activeStyle : tabsStyles.notActive);
    console.log(tabProps);
    return (
      <li className={tabsStyles.item}>
        <a
          href={href}
          className={linkClass}
          {...otherProps}
          aria-label={otherProps['aria-label'] || selectors.components.Tab.title(label!)}
          {...tabProps}
          ref={mainTabRef}
        >
          {content()}
        </a>
      </li>
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
  };
});
