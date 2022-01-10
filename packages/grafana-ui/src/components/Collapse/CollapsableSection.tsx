import React, { FC, ReactNode, useRef, useState } from 'react';
import { uniqueId } from 'lodash';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { Icon, Spinner } from '..';
import { GrafanaTheme2 } from '@grafana/data';
import { getFocusStyles } from '../../themes/mixins';

export interface Props {
  label: ReactNode;
  isOpen: boolean;
  /** Callback for the toggle functionality */
  onToggle?: (isOpen: boolean) => void;
  children: ReactNode;
  className?: string;
  loading?: boolean;
}

export const CollapsableSection: FC<Props> = ({ label, isOpen, onToggle, className, children, loading = false }) => {
  const [open, toggleOpen] = useState<boolean>(isOpen);
  const styles = useStyles2(collapsableSectionStyles);
  const tooltip = `Click to ${open ? 'collapse' : 'expand'}`;
  const onClick = () => {
    onToggle?.(!open);
    toggleOpen(!open);
  };
  const { current: id } = useRef(uniqueId());

  return (
    <>
      <div onClick={onClick} className={cx(styles.header, className)} title={tooltip}>
        <button
          id={`collapse-button-${id}`}
          className={styles.button}
          onClick={(e) => {
            e.preventDefault();
            onClick();
          }}
          aria-controls={`collapse-content-${id}`}
        >
          {loading ? (
            <Spinner className={styles.spinner} />
          ) : (
            <Icon name={open ? 'angle-down' : 'angle-right'} size="xl" className={styles.icon} />
          )}
        </button>
        <div className={styles.label}>{label}</div>
      </div>
      <div
        id={`collapse-content-${id}`}
        className={styles.content}
        aria-labelledby={`collapse-button-${id}`}
        aria-expanded={open && !loading}
      >
        {open && children}
      </div>
    </>
  );
};

const collapsableSectionStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    flexDirection: 'row-reverse',
    position: 'relative',
    justifyContent: 'space-between',
    fontSize: theme.typography.size.lg,
    padding: `${theme.spacing(0.5)} 0`,
    cursor: 'pointer',
    '& + div[aria-expanded=false]': {
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
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
    '&[aria-expanded=false]': {
      display: 'none',
    },
  }),
  spinner: css({
    height: '100%',
    width: theme.v1.spacing.lg,
    marginBottom: theme.v1.spacing.xxs,
    textAlign: 'center',
  }),
  label: css({
    display: 'flex',
  }),
});
