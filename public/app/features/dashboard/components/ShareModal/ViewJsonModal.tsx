import { useCallback } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Trans, t } from '@grafana/i18n';
import { ClipboardButton, CodeEditor, Modal } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

export interface ViewJsonModalProps {
  json: string;
  onDismiss: () => void;
}

export function ViewJsonModal({ json, onDismiss }: ViewJsonModalProps): JSX.Element {
  const getClipboardText = useCallback(() => json, [json]);
  return (
    <Modal
      title={t('dashboard.view-json-modal.title-json', 'JSON')}
      onDismiss={onDismiss}
      onClickBackdrop={onDismiss}
      isOpen
    >
      <AutoSizer disableHeight>
        {({ width }) => <CodeEditor value={json} language="json" showMiniMap={false} height="500px" width={width} />}
      </AutoSizer>
      <Modal.ButtonRow>
        <ClipboardButton
          icon="copy"
          getText={getClipboardText}
          onClipboardCopy={() => {
            DashboardInteractions.exportCopyJsonClicked();
          }}
        >
          <Trans i18nKey="share-modal.view-json.copy-button">Copy to Clipboard</Trans>
        </ClipboardButton>
      </Modal.ButtonRow>
    </Modal>
  );
}
