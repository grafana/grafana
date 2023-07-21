import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { ReactNode, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Spinner, useStyles2, Icon } from '@grafana/ui/src';
import { getFocusStyles } from '@grafana/ui/src/themes/mixins';

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
}

export const PromCollapsableSection = ({
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
}: Props) => {
  const [open, toggleOpen] = useState<boolean>(isOpen);
  const styles = useStyles2(collapsableSectionStyles);

  const onClick = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.tagName === 'A') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    onToggle?.(!open);
    toggleOpen(!open);
  };
  const { current: id } = useRef(uniqueId());

  const buttonLabelId = labelId ?? `collapse-label-${id}`;

  return (
    <>
      {/* disabling the a11y rules here as the button handles keyboard interactions */}
      {/* this is just to provide a better experience for mouse users */}

      <div className={cx(styles.border)}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={onClick} className={cx(styles.header, className)}>
          <button
            type="button"
            id={`collapse-button-${id}`}
            className={styles.button}
            onClick={onClick}
            aria-expanded={open && !loading}
            aria-controls={`collapse-content-${id}`}
            aria-labelledby={buttonLabelId}
          ></button>
          <div className={styles.label} id={`collapse-label-${id}`} data-testid={headerDataTestId}>
            {label}
          </div>

          {loading ? (
            <Spinner className={styles.spinner} />
          ) : (
            <Icon name={open ? 'angle-down' : 'angle-up'} className={styles.icon} />
          )}
        </div>
        {open && (
          <div
            id={`collapse-content-${id}`}
            className={cx(styles.content, contentClassName)}
            data-testid={contentDataTestId}
          >
            {children}
          </div>
        )}
      </div>
    </>
  );
};

const collapsableSectionStyles = (theme: GrafanaTheme2) => ({
  border: css`
    border-bottom: 1px solid ${theme.colors.border.weak};

    &:first-child {
      border-top: 1px solid ${theme.colors.border.weak};
    }

    &:last-child {
      border-bottom: none;
    }
  `,
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
    alignItems: 'center',
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
    alignSelf: 'center',
    color: theme.colors.text.secondary,
  }),
  content: css({}),
  spinner: css({
    display: 'flex',
    alignItems: 'center',
    width: theme.spacing(2),
  }),
  label: css({
    display: 'flex',
    width: '100%',
  }),
});
