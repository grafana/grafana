import { css, cx } from '@emotion/css';
import { useCallback, useRef, useState, useEffect } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { copyText } from '../../../src/utils/clipboard';
import { t } from '../../../src/utils/i18n';
import { useStyles2 } from '../../themes';
import { Button, ButtonProps } from '../Button';
import { Icon } from '../Icon/Icon';
import { InlineToast } from '../InlineToast/InlineToast';

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
    let timeoutId: ReturnType<typeof setTimeout>;

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

  const copiedText = t('clipboard-button.inline-toast.success', 'Copied');
  return (
    <>
      {showCopySuccess && (
        <InlineToast placement="top" referenceElement={buttonRef.current}>
          {copiedText}
        </InlineToast>
      )}

      <Button
        onClick={copyTextCallback}
        icon={icon}
        variant={showCopySuccess ? 'success' : variant}
        aria-label={showCopySuccess ? copiedText : undefined}
        {...buttonProps}
        className={cx(styles.button, showCopySuccess && styles.successButton, buttonProps.className)}
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
  };
};
