import { css, cx } from '@emotion/css';
import { useId, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';

const getStyles = (theme: GrafanaTheme2) => ({
  collapse: css({
    label: 'collapse',
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    position: 'relative',
    borderRadius: theme.shape.radius.default,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
  }),
  collapseBody: css({
    label: 'collapse__body',
    padding: theme.spacing(theme.components.panel.padding),
    paddingTop: 0,
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }),
  bodyContentWrapper: css({
    label: 'bodyContentWrapper',
    flex: 1,
  }),
  loader: css({
    label: 'collapse__loader',
    height: '2px',
    position: 'relative',
    overflow: 'hidden',
    background: 'none',
    margin: theme.spacing(0.5),
  }),
  loaderActive: css({
    label: 'collapse__loader_active',
    '&:after': {
      content: "' '",
      display: 'block',
      width: '25%',
      top: 0,
      height: '250%',
      position: 'absolute',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: 'loader 2s cubic-bezier(0.17, 0.67, 0.83, 0.67) 500ms',
        animationIterationCount: 100,
      },
      [theme.transitions.handleMotion('reduce')]: {
        animationDuration: '10s',
        animationIterationCount: 20,
      },
      left: '-25%',
      background: theme.colors.primary.main,
    },
    '@keyframes loader': {
      from: {
        left: '-25%',
        opacity: 0.1,
      },
      to: {
        left: '100%',
        opacity: 1,
      },
    },
  }),
  header: css({
    cursor: 'pointer',
    label: 'collapse__header',
    padding: theme.spacing(1),
    display: 'flex',
    gap: theme.spacing(1),
  }),
  button: css({
    marginRight: 0,
  }),
  headerLabel: css({
    label: 'collapse__header-label',
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.size.md,
    display: 'flex',
    flex: 1,
  }),
});

export interface Props {
  /** Expand or collapse te content */
  isOpen?: boolean;
  /** Element or text for the Collapse header */
  label: React.ReactNode;
  /** Indicates loading state of the content */
  loading?: boolean;
  /** Callback for the toggle functionality */
  onToggle?: (isOpen: boolean) => void;
  /** Additional class name for the root element */
  className?: string;
  /** @deprecated this prop is no longer used and will be removed in Grafana 13 */
  collapsible?: boolean;
}

export const ControlledCollapse = ({ isOpen, onToggle, ...otherProps }: React.PropsWithChildren<Props>) => {
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

/**
 * A content area, which can be horizontally collapsed and expanded. Can be used to hide extra information on the page.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/layout-collapse--docs
 */
export const Collapse = ({ isOpen, label, loading, onToggle, className, children }: React.PropsWithChildren<Props>) => {
  const style = useStyles2(getStyles);
  const labelId = useId();
  const contentId = useId();

  const onClickToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    }
  };
  const panelClass = cx([style.collapse, className]);
  const loaderClass = loading ? cx([style.loader, style.loaderActive]) : style.loader;

  return (
    <div className={panelClass}>
      {/* the inner button handles keyboard a11y. this is a convenience for mouse users */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={style.header} onClick={onClickToggle}>
        <IconButton
          aria-describedby={labelId}
          aria-expanded={isOpen}
          aria-controls={contentId}
          className={style.button}
          aria-labelledby={labelId}
          name={isOpen ? 'angle-down' : 'angle-right'}
        />
        <div id={labelId} className={style.headerLabel}>
          {label}
        </div>
      </div>
      {isOpen && (
        <div className={style.collapseBody} id={contentId}>
          <div className={loaderClass} />
          <div className={style.bodyContentWrapper}>{children}</div>
        </div>
      )}
    </div>
  );
};

Collapse.displayName = 'Collapse';
