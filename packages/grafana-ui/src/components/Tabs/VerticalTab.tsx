import { css, cx } from '@emotion/css';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

import { Counter } from './Counter';
import { TabProps } from './Tab';

export const VerticalTab = forwardRef<HTMLAnchorElement, TabProps>(
  ({ label, active, icon, counter, className, suffix: Suffix, onChangeTab, href, ...otherProps }, ref) => {
    const tabsStyles = useStyles2(getTabStyles);
    const content = () => (
      <>
        {icon && <Icon name={icon} />}
        {label}
        {typeof counter === 'number' && <Counter value={counter} />}
        {Suffix && <Suffix className={tabsStyles.suffix} />}
      </>
    );

    const linkClass = cx(tabsStyles.link, active && tabsStyles.activeStyle);

    return (
      <a
        href={href}
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
    );
  }
);

VerticalTab.displayName = 'Tab';

const getTabStyles = (theme: GrafanaTheme2) => {
  return {
    link: css({
      padding: '6px 12px',
      display: 'block',
      height: '100%',
      cursor: 'pointer',
      position: 'relative',

      color: theme.colors.text.primary,

      svg: {
        marginRight: theme.spacing(1),
      },

      '&:hover, &:focus': {
        textDecoration: 'underline',
      },
    }),
    activeStyle: css({
      label: 'activeTabStyle',
      color: theme.colors.text.maxContrast,
      overflow: 'hidden',

      '&::before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        left: 0,
        width: '4px',
        bottom: '2px',
        top: '2px',
        borderRadius: theme.shape.radius.default,
        backgroundImage: 'linear-gradient(0deg, #f05a28 30%, #fbca0a 99%)',
      },
    }),
    suffix: css({
      marginLeft: theme.spacing(1),
    }),
  };
};
