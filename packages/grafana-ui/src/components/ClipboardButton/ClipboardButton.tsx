import React, { useCallback } from 'react';
import { Button, ButtonProps } from '../Button';

export interface Props extends ButtonProps {
  /** A function that returns text to be copied */
  getText(): string;
  /** Callback when the text has been successfully copied */
  onClipboardCopy?(): void;
  /** Callback when there was an error copying the text */
  onClipboardError?(e: any): void;
}

export function ClipboardButton({ onClipboardCopy, onClipboardError, children, getText, ...buttonProps }: Props) {
  const copyText = useCallback(() => {
    navigator.clipboard.writeText(getText()).then(
      () => onClipboardCopy?.(),
      (e) => onClipboardError?.(e)
    );
  }, [getText, onClipboardCopy, onClipboardError]);

  return (
    <Button onClick={copyText} {...buttonProps}>
      {children}
    </Button>
  );
}
