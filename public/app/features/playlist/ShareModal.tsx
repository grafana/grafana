import React, { useState } from 'react';

import { SelectableValue, UrlQueryMap, urlUtil } from '@grafana/data';
import { Checkbox, ClipboardButton, Field, FieldSet, Input, Modal, RadioButtonGroup } from '@grafana/ui';
import { buildBaseUrl } from 'app/features/dashboard/components/ShareModal/utils';

import { PlaylistMode } from './types';

interface Props {
  playlistUid: string;
  onDismiss: () => void;
}

export const ShareModal = ({ playlistUid, onDismiss }: Props) => {
  const [mode, setMode] = useState<PlaylistMode>(false);
  const [autoFit, setAutofit] = useState(false);

  const modes: Array<SelectableValue<PlaylistMode>> = [
    { label: 'Normal', value: false },
    { label: 'TV', value: 'tv' },
    { label: 'Kiosk', value: true },
  ];

  const params: UrlQueryMap = {};
  if (mode) {
    params.kiosk = mode;
  }
  if (autoFit) {
    params.autofitpanels = true;
  }

  const shareUrl = urlUtil.renderUrl(`${buildBaseUrl()}/play/${playlistUid}`, params);

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
              <ClipboardButton icon="copy" variant="primary" getText={() => shareUrl}>
                Copy
              </ClipboardButton>
            }
          />
        </Field>
      </FieldSet>
    </Modal>
  );
};
