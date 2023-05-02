import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { clearButtonStyles } from '../Button';
import { Icon } from '../Icon/Icon';

const getStyles = (theme: GrafanaTheme2) => ({
  collapse: css`
    label: collapse;
    margin-bottom: ${theme.spacing(1)};
    background-color: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    position: relative;
    border-radius: ${theme.shape.radius.default};
    width: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
  `,
  collapseBody: css`
    label: collapse__body;
    padding: ${theme.spacing(theme.components.panel.padding)};
    padding-top: 0;
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `,
  bodyContentWrapper: css`
    label: bodyContentWrapper;
    flex: 1;
    overflow: hidden;
  `,
  loader: css`
    label: collapse__loader;
    height: 2px;
    position: relative;
    overflow: hidden;
    background: none;
    margin: ${theme.spacing(0.5)};
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
      background: ${theme.colors.primary.main};
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
    padding: ${theme.spacing(1, 2, 1, 2)};
    display: flex;
    transition: all 0.1s linear;
  `,
  headerCollapsed: css`
    label: collapse__header--collapsed;
    padding: ${theme.spacing(1, 2, 1, 2)};
  `,
  headerLabel: css`
    label: collapse__header-label;
    font-weight: ${theme.typography.fontWeightMedium};
    margin-right: ${theme.spacing(1)};
    font-size: ${theme.typography.size.md};
  `,
  icon: css`
    label: collapse__icon;
    margin: ${theme.spacing(0.25, 1, 0, -1)};
  `,
});

export interface Props {
  /** Expand or collapse te content */
  isOpen?: boolean;
  /** Element or text for the Collapse header */
  label: React.ReactNode;
  /** Indicates loading state of the content */
  loading?: boolean;
  /** Toggle collapsed header icon */
  collapsible?: boolean;
  /** Callback for the toggle functionality */
  onToggle?: (isOpen: boolean) => void;
  /** Additional class name for the root element */
  className?: string;
}

export const ControlledCollapse = ({ isOpen, onToggle, ...otherProps }: React.PropsWithChildren<Props>) => {
  const [open, setOpen] = useState(isOpen);
  return (
    <Collapse
      isOpen={open}
      collapsible
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

export const Collapse = ({
  isOpen,
  label,
  loading,
  collapsible,
  onToggle,
  className,
  children,
}: React.PropsWithChildren<Props>) => {
  const buttonStyles = useStyles2(clearButtonStyles);
  const style = useStyles2(getStyles);
  const onClickToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    }
  };

  const panelClass = cx([style.collapse, className]);
  const loaderClass = loading ? cx([style.loader, style.loaderActive]) : cx([style.loader]);
  const headerClass = collapsible ? cx([style.header]) : cx([style.headerCollapsed]);

  return (
    <div className={panelClass}>
      <button type="button" className={cx(buttonStyles, headerClass)} onClick={onClickToggle}>
        {collapsible && <Icon className={style.icon} name={isOpen ? 'angle-down' : 'angle-right'} />}
        <div className={cx([style.headerLabel])}>{label}</div>
      </button>
      {isOpen && (
        <div className={cx([style.collapseBody])}>
          <div className={loaderClass} />
          <div className={style.bodyContentWrapper}>{children}</div>
        </div>
      )}
    </div>
  );
};

Collapse.displayName = 'Collapse';
