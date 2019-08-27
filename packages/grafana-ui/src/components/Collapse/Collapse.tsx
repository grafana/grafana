import React, { FunctionComponent, useContext } from 'react';
import { css, cx } from 'emotion';

import { GrafanaTheme } from '../../types/theme';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import { ThemeContext } from '../../themes/index';

const getStyles = (theme: GrafanaTheme) => ({
  collapse: css`
    label: collapse;
    margin-top: ${theme.spacing.sm};
  `,
  collapseBody: css`
    label: collapse__body;
    padding: ${theme.panelPadding};
  `,
  loader: css`
    label: collapse__loader;
    height: 2px;
    position: relative;
    overflow: hidden;
    background: none;
    margin: ${theme.spacing.xs};
  `,
  loaderActive: css`
    label: collapse__loader_active;
    &:after {
      content: ' ';
      display: block;
      width: 25%;
      top: 0;
      top: -50%;
      height: 250%;
      position: absolute;
      animation: loader 2s cubic-bezier(0.17, 0.67, 0.83, 0.67) 500ms;
      animation-iteration-count: 100;
      left: -25%;
      background: ${theme.colors.blue};
    }
    @keyframes loader {
      from {
        left: -25%;
        opacity: 0.1;
      }
      to {
        left: 100%;
        opacity: 1;
      }
    }
  `,
  header: css`
    label: collapse__header;
    padding: ${theme.spacing.sm} ${theme.spacing.md} 0 ${theme.spacing.md};
    display: flex;
    cursor: inherit;
    transition: all 0.1s linear;
    cursor: pointer;
  `,
  headerCollapsed: css`
    label: collapse__header--collapsed;
    cursor: pointer;
  `,
  headerButtons: css`
    label: collapse__header-buttons;
    margin-right: ${theme.spacing.sm};
    font-size: ${theme.typography.size.lg};
    line-height: ${theme.typography.heading.h6};
    display: inherit;
  `,
  headerButtonsCollapsed: css`
    label: collapse__header-buttons--collapsed;
    display: none;
  `,
  headerLabel: css`
    label: collapse__header-label;
    font-weight: ${theme.typography.weight.semibold};
    margin-right: ${theme.spacing.sm};
    font-size: ${theme.typography.heading.h6};
    box-shadow: ${selectThemeVariant({ light: 'none', dark: '1px 1px 4px rgb(45, 45, 45)' }, theme.type)};
  `,
});

interface Props {
  isOpen: boolean;
  label: string;
  loading?: boolean;
  collapsible?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export const Collapse: FunctionComponent<Props> = ({ isOpen, label, loading, collapsible, onToggle, children }) => {
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);
  const onClickToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    }
  };

  const panelClass = cx([style.collapse, 'panel-container']);
  const iconClass = isOpen ? 'fa fa-caret-up' : 'fa fa-caret-down';
  const loaderClass = loading ? cx([style.loader, style.loaderActive]) : cx([style.loader]);
  const headerClass = collapsible ? cx([style.header]) : cx([style.headerCollapsed]);
  const headerButtonsClass = collapsible ? cx([style.headerButtons]) : cx([style.headerButtonsCollapsed]);

  return (
    <div className={panelClass}>
      <div className={headerClass} onClick={onClickToggle}>
        <div className={headerButtonsClass}>
          <span className={iconClass} />
        </div>
        <div className={cx([style.headerLabel])}>{label}</div>
      </div>
      {isOpen && (
        <div className={cx([style.collapseBody])}>
          <div className={loaderClass} />
          {children}
        </div>
      )}
    </div>
  );
};

Collapse.displayName = 'Collapse';
