import { isString } from 'lodash';
import React, { useEffect, useState } from 'react';

import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Icon } from '../Icon/Icon';
import { Modal } from '../Modal/Modal';
import { CodeEditor } from '../Monaco/CodeEditor';

interface TableCellInspectModalProps {
  value: any;
  onDismiss: () => void;
  mode: 'code' | 'text';
}

export function TableCellInspectModal({ value, onDismiss, mode }: TableCellInspectModalProps) {
  const [isInClipboard, setIsInClipboard] = useState(false);
  const timeoutRef = React.useRef<number>();

  useEffect(() => {
    if (isInClipboard) {
      timeoutRef.current = window.setTimeout(() => {
        setIsInClipboard(false);
      }, 2000);
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [isInClipboard]);

  let displayValue = value;
  if (isString(value)) {
    try {
      value = JSON.parse(value);
    } catch {} // ignore errors
  } else {
    displayValue = JSON.stringify(value, null, ' ');
  }
  let text = displayValue;

  if (mode === 'code') {
    text = JSON.stringify(value, null, ' ');
  }

  return (
    <Modal onDismiss={onDismiss} isOpen={true} title="Inspect value">
      {mode === 'code' ? (
        <CodeEditor
          width="100%"
          height={500}
          language="json"
          showLineNumbers={true}
          showMiniMap={(text && text.length) > 100}
          value={text}
          readOnly={true}
        />
      ) : (
        <pre>{text}</pre>
      )}
      <Modal.ButtonRow>
        <ClipboardButton getText={() => text} onClipboardCopy={() => setIsInClipboard(true)}>
          {!isInClipboard ? (
            'Copy to Clipboard'
          ) : (
            <>
              <Icon name="check" />
              Copied to clipboard
            </>
          )}
        </ClipboardButton>
      </Modal.ButtonRow>
    </Modal>
  );
}
