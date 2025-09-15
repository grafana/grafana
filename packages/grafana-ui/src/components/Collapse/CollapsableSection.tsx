import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { ReactNode, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';
import { Text } from '../Text/Text';
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
  newDesign?: boolean;
  isOptionalTag?: boolean;
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
  newDesign,
  isOptionalTag,
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
      className={newDesign ? cx(styles.newDesignContent, contentClassName) : cx(styles.content, contentClassName, {
        [styles.contentHidden]: !unmountContentWhenClosed && !isSectionOpen,
      })}
      data-testid={contentDataTestId}
    >
      {children}
    </div>
  );

  return (
    <>
      <div className={newDesign ? styles.newDesignContainer : undefined}>
      {/* disabling the a11y rules here as the button handles keyboard interactions */}
      {/* this is just to provide a better experience for mouse users */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div onClick={onClick} className={newDesign ? cx(styles.newDesignHeader, className) : cx(styles.header, className)}>
          <button
            type="button"
            id={`collapse-button-${id}`}
            className={newDesign ? styles.newDesignButton : styles.button}
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
        <div>
          {isOptionalTag && 
            <div className={styles.optionalTag}>
              <Text variant="bodySmall">{`Optional`}</Text>
            </div>
          }
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
  newDesignHeader: css({
    display: 'flex',
    cursor: 'pointer',
    boxSizing: 'border-box',
    fontSize: theme.typography.size.lg,
    padding: `${theme.spacing(2)}`,
    '&:focus-within': getFocusStyles(theme),
  }),
  newDesignContainer: css({
    display: 'flex',
    justifyContent: 'space-between',
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
  newDesignButton: css({
     all: 'unset',
    '&:focus-visible': {
      outline: 'none',
      outlineOffset: 'unset',
      transition: 'none',
      boxShadow: 'none',
    },
    marginRight: theme.spacing(1),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(2),
  }),
  icon: css({
    color: theme.colors.text.secondary,
  }),
  content: css({
    padding: `${theme.spacing(2)} 0`,
  }),
  newDesignContent: css({
    padding: `${theme.spacing(2)}`,
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
  optionalTag: css({
    // eslint-disable-next-line @grafana/no-border-radius-literal
    borderRadius: 5,       
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.5)}`,
    marginRight: theme.spacing(3),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    border: `1px solid`,
  }),
});
