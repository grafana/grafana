import React, { useCallback } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { ClipboardButton, CodeEditor, Modal } from '@grafana/ui';

import { notifyApp } from '../../../../core/actions';
import { createSuccessNotification } from '../../../../core/copy/appNotification';
import { dispatch } from '../../../../store/store';

export interface ViewJsonModalProps {
  json: string;
  onDismiss: () => void;
}

export function ViewJsonModal({ json, onDismiss }: ViewJsonModalProps): JSX.Element {
  const getClipboardText = useCallback(() => json, [json]);
  const onClipboardCopy = () => {
    dispatch(notifyApp(createSuccessNotification('Content copied to clipboard')));
  };
  return (
    <Modal title="JSON" onDismiss={onDismiss} onClickBackdrop={onDismiss} isOpen>
      <AutoSizer disableHeight>
        {({ width }) => <CodeEditor value={json} language="json" showMiniMap={false} height="500px" width={width} />}
      </AutoSizer>
      <Modal.ButtonRow>
        <ClipboardButton getText={getClipboardText} onClipboardCopy={onClipboardCopy}>
          Copy to Clipboard
        </ClipboardButton>
      </Modal.ButtonRow>
    </Modal>
  );
}
