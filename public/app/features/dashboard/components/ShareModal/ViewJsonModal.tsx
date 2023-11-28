import React, { useCallback } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { ClipboardButton, CodeEditor, Modal } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

export interface ViewJsonModalProps {
  json: string;
  onDismiss: () => void;
}

export function ViewJsonModal({ json, onDismiss }: ViewJsonModalProps): JSX.Element {
  const getClipboardText = useCallback(() => json, [json]);
  return (
    <Modal title="JSON" onDismiss={onDismiss} onClickBackdrop={onDismiss} isOpen>
      <AutoSizer disableHeight>
        {({ width }) => <CodeEditor value={json} language="json" showMiniMap={false} height="500px" width={width} />}
      </AutoSizer>
      <Modal.ButtonRow>
        <ClipboardButton icon="copy" getText={getClipboardText}>
          <Trans i18nKey="share-modal.view-json.copy-button">Copy to Clipboard</Trans>
        </ClipboardButton>
      </Modal.ButtonRow>
    </Modal>
  );
}
