import { css, cx } from '@emotion/css';
import React, { HTMLProps, ReactNode } from 'react';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { stylesFactory, useTheme2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types';
import { Button } from '../Button';
import { Icon } from '../Icon/Icon';

import { Counter } from './Counter';

export interface TabProps {
  label: string;
  active?: boolean;
  /** When provided, it is possible to use the tab as a hyperlink. Use in cases where the tabs update location. */
  href?: string;
  icon?: IconName;
  onChangeTab?: (event?: React.MouseEvent<HTMLElement>) => void;
  /** A number rendered next to the text. Usually used to display the number of items in a tab's view. */
  counter?: number | null;
  /** Extra content, displayed after the tab label and counter */
  suffix?: NavModelItem['tabSuffix'];
  children?: ReactNode;
  value?: string;
}

interface TabAsLinkProps extends HTMLProps<HTMLAnchorElement>, TabProps {
  onChangeTab?: (event?: React.MouseEvent<HTMLAnchorElement>) => void;
  ref: string;
}

interface TabAsButtonProps extends HTMLProps<HTMLButtonElement>, TabProps {
  onChangeTab?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
}

const TabAsLink = ({
  tabClass,
  onChangeTab,
  href,
  ariaLabel,
  active,
  children,
  ref,
  ...otherProps
}: TabAsLinkProps) => {
  return (
    <a
      href={href}
      className={tabClass}
      {...otherProps}
      onClick={onChangeTab}
      aria-label={ariaLabel}
      role="tab"
      aria-selected={active}
      ref={ref}
    >
      {children}
    </a>
  );
};

const TabAsButton = ({ tabClass, onChangeTab, ariaLabel, active, children, ...otherProps }: TabAsButtonProps) => {
  return (
    <Button
      className={tabClass}
      variant="secondary"
      fill="text"
      onClick={onChangeTab}
      aria-label={ariaLabel}
      role="tab"
      aria-selected={active}
      {...otherProps}
    >
      {children}
    </Button>
  );
};

export const Tab = React.forwardRef<HTMLElement, TabProps>(
  ({ label, active, icon, counter, suffix: Suffix, href, onChangeTab, ...otherProps }, ref) => {
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

    const ariaLabel = otherProps['aria-label'] || selectors.components.Tab.title(label);
    const tabClass = cx(tabsStyles.tab, active ? tabsStyles.activeStyle : tabsStyles.notActive);

    return (
      <div className={tabsStyles.tabContainer}>
        {href ? (
          <TabAsLink
            href={href}
            className={tabClass}
            {...otherProps}
            onClick={onChangeTab}
            aria-label={ariaLabel}
            aria-selected={active}
            ref={ref}
          >
            {content()}
          </TabAsLink>
        ) : (
          <TabAsButton
            className={tabClass}
            onClick={onChangeTab}
            aria-label={ariaLabel}
            aria-selected={active}
            {...otherProps}
          >
            {content()}
          </TabAsButton>
        )}
      </div>
    );
  }
);

Tab.displayName = 'Tab';

const getTabStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    tabContainer: css`
      list-style: none;
      position: relative;
      display: flex;
    `,
    tab: css`
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
          bottom: 0;
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
