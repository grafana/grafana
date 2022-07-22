import { keyframes, css, cx } from '@emotion/css';
import { relative } from 'node:path/win32';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Popper } from 'react-popper';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Button, ButtonProps } from '../Button';
import { Icon } from '../Icon/Icon';
import Indicator from '../Indicator/Indicator';

export interface Props extends ButtonProps {
  /** A function that returns text to be copied */
  getText(): string;
  /** Callback when the text has been successfully copied */
  onClipboardCopy?(copiedText: string): void;
  /** Callback when there was an error copying the text */
  onClipboardError?(copiedText: string, error: unknown): void;
}

const SHOW_SUCCESS_DURATION = 2 * 1000;

export function ClipboardButton({
  onClipboardCopy,
  onClipboardError,
  children,
  getText,
  icon,
  variant,
  ...buttonProps
}: Props) {
  const styles = useStyles2(getStyles);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (showCopySuccess) {
      timeoutId = setTimeout(() => {
        setShowCopySuccess(false);
      }, SHOW_SUCCESS_DURATION);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showCopySuccess]);

  const buttonRef = useRef<null | HTMLButtonElement>(null);
  const copyTextCallback = useCallback(async () => {
    const textToCopy = getText();

    try {
      await copyText(textToCopy, buttonRef);
      setShowCopySuccess(true);
      onClipboardCopy?.(textToCopy);
    } catch (e) {
      onClipboardError?.(textToCopy, e);
    }
  }, [getText, onClipboardCopy, onClipboardError]);

  return (
    <>
      {showCopySuccess && (
        <Popper placement="top" referenceElement={buttonRef.current ?? undefined}>
          {({ ref, style, placement }) => {
            return (
              <div ref={ref} style={style} data-placement={placement}>
                <div className={styles.appearAnimation}>
                  <Indicator suffixIcon="check">Copied</Indicator>
                </div>
              </div>
            );
          }}
        </Popper>
      )}

      <Button
        onClick={copyTextCallback}
        icon={icon}
        variant={showCopySuccess ? 'success' : variant}
        aria-label={showCopySuccess ? 'Copied' : undefined}
        {...buttonProps}
        className={cx(styles.button, showCopySuccess && styles.successButton)}
        ref={buttonRef}
      >
        {children}

        {showCopySuccess && (
          <div className={styles.successOverlay}>
            <Icon name="check" />
          </div>
        )}
      </Button>
    </>
  );
}

const copyText = async (text: string, buttonRef: React.MutableRefObject<HTMLButtonElement | null>) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Use a fallback method for browsers/contexts that don't support the Clipboard API.
    // See https://web.dev/async-clipboard/#feature-detection.
    const input = document.createElement('input');
    // Normally we'd append this to the body. However if we're inside a focus manager
    // from react-aria, we can't focus anything outside of the managed area.
    // Instead, let's append it to the button. Then we're guaranteed to be able to focus + copy.
    buttonRef.current?.appendChild(input);
    input.value = text;
    input.focus();
    input.select();
    document.execCommand('copy');
    input.remove();
  }
};

const flyUpAnimation = keyframes({
  from: {
    opacity: 0,
    transform: 'translate(0, 8px)',
  },

  to: {
    opacity: 1,
    transform: 'translate(0, 0px)',
  },
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      position: 'relative',
    }),
    successButton: css({
      '> *': css({
        visibility: 'hidden',
      }),
    }),
    successOverlay: css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      left: 0,
      visibility: 'visible', // re-visible the overlay
    }),
    appearAnimation: css({
      paddingBottom: theme.spacing(1),
      animation: `${flyUpAnimation} ease-out 100ms`,
    }),
  };
};
