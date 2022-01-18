import React, { useState } from 'react';
import { AppEvents, SelectableValue, UrlQueryMap, urlUtil } from '@grafana/data';
import { Checkbox, ClipboardButton, Field, FieldSet, Icon, Input, Modal, RadioButtonGroup } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { buildBaseUrl } from '../dashboard/components/ShareModal/utils';
import { PlaylistMode } from './types';

interface ShareModalProps {
  playlistId: number;
  onDismiss: () => void;
}

export const ShareModal = ({ playlistId, onDismiss }: ShareModalProps) => {
  const [mode, setMode] = useState<PlaylistMode>(false);
  const [autoFit, setAutofit] = useState(false);

  const modes: Array<SelectableValue<PlaylistMode>> = [
    { label: 'Normal', value: false },
    { label: 'TV', value: 'tv' },
    { label: 'Kiosk', value: true },
  ];

  const onShareUrlCopy = () => {
    appEvents.emit(AppEvents.alertSuccess, ['Content copied to clipboard']);
  };

  const params: UrlQueryMap = {};
  if (mode) {
    params.kiosk = mode;
  }
  if (autoFit) {
    params.autofitpanels = true;
  }

  const shareUrl = urlUtil.renderUrl(`${buildBaseUrl()}/play/${playlistId}`, params);

  return (
    <Modal isOpen={true} title="Share playlist" onDismiss={onDismiss}>
      <FieldSet>
        <Field label="Mode">
          <RadioButtonGroup value={mode} options={modes} onChange={setMode} />
        </Field>
        <Field>
          <Checkbox
            label="Autofit"
            description="Panel heights will be adjusted to fit screen size"
            name="autofix"
            value={autoFit}
            onChange={(e) => setAutofit(e.currentTarget.checked)}
          />
        </Field>

        <Field label="Link URL">
          <Input
            id="link-url-input"
            value={shareUrl}
            readOnly
            addonAfter={
              <ClipboardButton variant="primary" getText={() => shareUrl} onClipboardCopy={onShareUrlCopy}>
                <Icon name="copy" /> Copy
              </ClipboardButton>
            }
          />
        </Field>
      </FieldSet>
    </Modal>
  );
};
