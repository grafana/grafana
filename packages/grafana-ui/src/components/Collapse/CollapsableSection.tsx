import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { ReactNode, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

export interface Props {
  label: ReactNode;
  isOpen: boolean;
  /** Callback for the toggle functionality */
  onToggle?: (isOpen: boolean) => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  loading?: boolean;
  labelId?: string;
  headerDataTestId?: string;
  contentDataTestId?: string;
  unmountContentWhenClosed?: boolean;
}

export const CollapsableSection = ({
  label,
  isOpen,
  onToggle,
  className,
  contentClassName,
  children,
  labelId,
  loading = false,
  headerDataTestId,
  contentDataTestId,
  unmountContentWhenClosed = true,
}: Props) => {
  const [internalOpenState, toggleInternalOpenState] = useState<boolean>(isOpen);
  const styles = useStyles2(collapsableSectionStyles);

  const isControlled = isOpen !== undefined && onToggle !== undefined;
  const isSectionOpen = isControlled ? isOpen : internalOpenState;

  const onClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.tagName === 'A') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    onToggle?.(!isOpen);

    if (!isControlled) {
      toggleInternalOpenState(!internalOpenState);
    }
  };
  const { current: id } = useRef(uniqueId());

  const buttonLabelId = labelId ?? `collapse-label-${id}`;

  const content = (
    <div
      id={`collapse-content-${id}`}
      className={cx(styles.content, contentClassName, {
        [styles.contentHidden]: !unmountContentWhenClosed && !isSectionOpen,
      })}
      data-testid={contentDataTestId}
    >
      {children}
    </div>
  );

  return (
    <>
      {/* disabling the a11y rules here as the button handles keyboard interactions */}
      {/* this is just to provide a better experience for mouse users */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div onClick={onClick} className={cx(styles.header, className)}>
        <button
          type="button"
          id={`collapse-button-${id}`}
          className={styles.button}
          onClick={onClick}
          aria-expanded={isSectionOpen && !loading}
          aria-controls={`collapse-content-${id}`}
          aria-labelledby={buttonLabelId}
        >
          {loading ? (
            <Spinner className={styles.spinner} />
          ) : (
            <Icon name={isSectionOpen ? 'angle-up' : 'angle-down'} className={styles.icon} />
          )}
        </button>
        <div className={styles.label} id={`collapse-label-${id}`} data-testid={headerDataTestId}>
          {label}
        </div>
      </div>
      {unmountContentWhenClosed ? isSectionOpen && content : content}
    </>
  );
};

const collapsableSectionStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    cursor: 'pointer',
    boxSizing: 'border-box',
    flexDirection: 'row-reverse',
    position: 'relative',
    justifyContent: 'space-between',
    fontSize: theme.typography.size.lg,
    padding: `${theme.spacing(0.5)} 0`,
    '&:focus-within': getFocusStyles(theme),
  }),
  button: css({
    all: 'unset',
    '&:focus-visible': {
      outline: 'none',
      outlineOffset: 'unset',
      transition: 'none',
      boxShadow: 'none',
    },
  }),
  icon: css({
    color: theme.colors.text.secondary,
  }),
  content: css({
    padding: `${theme.spacing(2)} 0`,
  }),
  contentHidden: css({
    display: 'none',
  }),
  spinner: css({
    display: 'flex',
    alignItems: 'center',
    width: theme.spacing(2),
  }),
  label: css({
    display: 'flex',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.maxContrast,
  }),
});
