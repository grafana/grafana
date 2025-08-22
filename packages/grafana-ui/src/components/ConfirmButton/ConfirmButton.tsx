import { cx, css } from '@emotion/css';
import { ReactElement, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { ComponentSize } from '../../types/size';
import { Button, ButtonVariant } from '../Button/Button';

export interface Props {
  /** Confirm action callback */
  onConfirm(): void;
  children: string | ReactElement;
  /** Custom button styles */
  className?: string;
  /** Button size */
  size?: ComponentSize;
  /** Text for the Confirm button */
  confirmText?: string;
  /** Disable button click action */
  disabled?: boolean;
  /** Variant of the Confirm button */
  confirmVariant?: ButtonVariant;
  /** Hide confirm actions when after of them is clicked */
  closeOnConfirm?: boolean;
  /** Optional on click handler for the original button */
  onClick?(): void;
  /** Callback for the cancel action */
  onCancel?(): void;
}

export const ConfirmButton = ({
  children,
  className,
  closeOnConfirm,
  confirmText = 'Save',
  confirmVariant = 'primary',
  disabled = false,
  onCancel,
  onClick,
  onConfirm,
  size = 'md',
}: Props) => {
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [shouldRestoreFocus, setShouldRestoreFocus] = useState(false);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (showConfirm) {
      confirmButtonRef.current?.focus();
      setShouldRestoreFocus(true);
    } else {
      if (shouldRestoreFocus) {
        mainButtonRef.current?.focus();
        setShouldRestoreFocus(false);
      }
    }
  }, [shouldRestoreFocus, showConfirm]);

  const onClickButton = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.preventDefault();
    }

    setShowConfirm(true);
    onClick?.();
  };

  const onClickCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.preventDefault();
    }
    setShowConfirm(false);
    mainButtonRef.current?.focus();
    onCancel?.();
  };

  const onClickConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.preventDefault();
    }
    onConfirm?.();
    if (closeOnConfirm) {
      setShowConfirm(false);
    }
  };

  const buttonClass = cx(className, styles.mainButton, {
    [styles.mainButtonHide]: showConfirm,
  });
  const confirmButtonClass = cx(styles.confirmButton, {
    [styles.confirmButtonHide]: !showConfirm,
  });
  const confirmButtonContainerClass = cx(styles.confirmButtonContainer, {
    [styles.confirmButtonContainerHide]: !showConfirm,
  });

  return (
    <div className={styles.container}>
      <span className={buttonClass}>
        {typeof children === 'string' ? (
          <Button disabled={disabled} size={size} fill="text" onClick={onClickButton} ref={mainButtonRef}>
            {children}
          </Button>
        ) : (
          React.cloneElement(children, { disabled, onClick: onClickButton, ref: mainButtonRef })
        )}
      </span>
      <div className={confirmButtonContainerClass}>
        <span className={confirmButtonClass}>
          <Button size={size} variant={confirmVariant} onClick={onClickConfirm} ref={confirmButtonRef}>
            {confirmText}
          </Button>
          <Button size={size} fill="text" onClick={onClickCancel}>
            <Trans i18nKey="grafana-ui.confirm-button.cancel">Cancel</Trans>
          </Button>
        </span>
      </div>
    </div>
  );
};
ConfirmButton.displayName = 'ConfirmButton';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'flex-end',
      position: 'relative',
    }),
    mainButton: css({
      opacity: 1,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.shortest,
          easing: theme.transitions.easing.easeOut,
        }),
      },
      zIndex: 2,
    }),
    mainButtonHide: css({
      opacity: 0,
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['opacity', 'visibility'], {
          duration: theme.transitions.duration.shortest,
          easing: theme.transitions.easing.easeIn,
        }),
      },
      visibility: 'hidden',
      zIndex: 0,
    }),
    confirmButtonContainer: css({
      overflow: 'visible',
      position: 'absolute',
      pointerEvents: 'all',
      right: 0,
    }),
    confirmButtonContainerHide: css({
      overflow: 'hidden',
      pointerEvents: 'none',
    }),
    confirmButton: css({
      alignItems: 'flex-start',
      background: theme.colors.background.primary,
      display: 'flex',
      opacity: 1,
      transform: 'translateX(0)',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['opacity', 'transform'], {
          duration: theme.transitions.duration.shortest,
          easing: theme.transitions.easing.easeOut,
        }),
      },
      zIndex: 1,
    }),
    confirmButtonHide: css({
      opacity: 0,
      transform: 'translateX(100%)',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create(['opacity', 'transform', 'visibility'], {
          duration: theme.transitions.duration.shortest,
          easing: theme.transitions.easing.easeIn,
        }),
      },
      visibility: 'hidden',
    }),
  };
};
