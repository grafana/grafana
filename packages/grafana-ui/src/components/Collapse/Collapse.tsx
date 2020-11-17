import React, { FunctionComponent, useContext, useState } from 'react';
import { css, cx } from 'emotion';

import { GrafanaTheme } from '@grafana/data';
import { ThemeContext } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { Icon } from '../Icon/Icon';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  collapse: css`
    label: collapse;
    margin-bottom: ${theme.spacing.sm};
  `,
  collapseBody: css`
    label: collapse__body;
    padding: ${theme.panelPadding}px;
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
      background: ${theme.palette.blue85};
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
    padding: ${theme.spacing.sm} ${theme.spacing.md};
    display: flex;
    cursor: inherit;
    transition: all 0.1s linear;
    cursor: pointer;
  `,
  headerCollapsed: css`
    label: collapse__header--collapsed;
    cursor: pointer;
    padding: ${theme.spacing.sm} ${theme.spacing.md};
  `,
  headerButtons: css`
    label: collapse__header-buttons;
    margin-right: ${theme.spacing.sm};
    margin-top: ${theme.spacing.xxs};
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
  `,
}));

export interface Props {
  /** Expand or collapse te content */
  isOpen?: boolean;
  /** Text for the Collapse header */
  label: string;
  /** Indicates loading state of the content */
  loading?: boolean;
  /** Toggle collapsed header icon */
  collapsible?: boolean;
  /** Callback for the toggle functionality */
  onToggle?: (isOpen: boolean) => void;
}

export const ControlledCollapse: FunctionComponent<Props> = ({ isOpen, onToggle, ...otherProps }) => {
  const [open, setOpen] = useState(isOpen);
  return (
    <Collapse
      isOpen={open}
      {...otherProps}
      onToggle={() => {
        setOpen(!open);
        if (onToggle) {
          onToggle(!open);
        }
      }}
    />
  );
};

export const Collapse: FunctionComponent<Props> = ({ isOpen, label, loading, collapsible, onToggle, children }) => {
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);
  const onClickToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    }
  };

  const panelClass = cx([style.collapse, 'panel-container']);
  const loaderClass = loading ? cx([style.loader, style.loaderActive]) : cx([style.loader]);
  const headerClass = collapsible ? cx([style.header]) : cx([style.headerCollapsed]);
  const headerButtonsClass = collapsible ? cx([style.headerButtons]) : cx([style.headerButtonsCollapsed]);

  return (
    <div className={panelClass}>
      <div className={headerClass} onClick={onClickToggle}>
        <div className={headerButtonsClass}>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
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
