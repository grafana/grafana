import React, { useCallback, useRef } from 'react';

import { Button, ButtonProps } from '../Button';

/** @deprecated Will be removed in next major release */
interface ClipboardEvent {
  action: string;
  text: string;
  trigger: Element;
  clearSelection(): void;
}

export interface Props extends ButtonProps {
  /** A function that returns text to be copied */
  getText(): string;
  /** Callback when the text has been successfully copied */
  onClipboardCopy?(e: ClipboardEvent): void;
  /** Callback when there was an error copying the text */
  onClipboardError?(e: ClipboardEvent): void;
}

const dummyClearFunc = () => {};

export function ClipboardButton({ onClipboardCopy, onClipboardError, children, getText, ...buttonProps }: Props) {
  const buttonRef = useRef<null | HTMLButtonElement>(null);
  const copyTextCallback = useCallback(async () => {
    const textToCopy = getText();
    // Can be removed in 9.x
    const dummyEvent: ClipboardEvent = {
      action: 'copy',
      clearSelection: dummyClearFunc,
      text: textToCopy,
      trigger: buttonRef.current!,
    };
    try {
      await copyText(textToCopy, buttonRef);
      onClipboardCopy?.(dummyEvent);
    } catch {
      onClipboardError?.(dummyEvent);
    }
  }, [getText, onClipboardCopy, onClipboardError]);

  return (
    <Button onClick={copyTextCallback} {...buttonProps} ref={buttonRef}>
      {children}
    </Button>
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
