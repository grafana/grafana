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
  // Can be removed in 9.x
  const buttonRef = useRef<null | HTMLButtonElement>(null);
  const copyText = useCallback(() => {
    const copiedText = getText();
    const dummyEvent: ClipboardEvent = {
      action: 'copy',
      clearSelection: dummyClearFunc,
      text: copiedText,
      trigger: buttonRef.current!,
    };
    navigator.clipboard
      .writeText(copiedText)
      .then(() => (onClipboardCopy?.(dummyEvent), () => onClipboardError?.(dummyEvent)));
  }, [getText, onClipboardCopy, onClipboardError]);

  return (
    <Button onClick={copyText} {...buttonProps} ref={buttonRef}>
      {children}
    </Button>
  );
}
