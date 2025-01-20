import { useState } from 'react';

import { SelectableValue, UrlQueryMap, urlUtil } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Checkbox, ClipboardButton, Field, FieldSet, Input, Modal, RadioButtonGroup } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
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
    { label: t('share-playlist.mode-normal', 'Normal'), value: false },
    { label: t('share-playlist.mode-kiosk', 'Kiosk'), value: true },
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
    <Modal isOpen={true} title={t('share-playlist.title', 'Share playlist')} onDismiss={onDismiss}>
      <FieldSet>
        <Field label={t('share-playlist.mode', 'Mode')}>
          <RadioButtonGroup value={mode} options={modes} onChange={setMode} />
        </Field>
        <Field>
          <Checkbox
            label={t('share-playlist.checkbox-label', 'Autofit')}
            description={t('share-playlist.checkbox-description', 'Panel heights will be adjusted to fit screen size')}
            name="autofix"
            value={autoFit}
            onChange={(e) => setAutofit(e.currentTarget.checked)}
          />
        </Field>

        <Field label={t('share-playlist.link-url-label', 'Link URL')}>
          <Input
            id="link-url-input"
            value={shareUrl}
            readOnly
            addonAfter={
              <ClipboardButton
                icon="copy"
                variant="primary"
                getText={() => shareUrl}
                onClipboardCopy={() => {
                  reportInteraction('grafana_kiosk_mode', {
                    action: 'share_playlist',
                    mode: mode,
                  });
                }}
              >
                <Trans i18nKey="share-playlist.copy-link-button">Copy</Trans>
              </ClipboardButton>
            }
          />
        </Field>
      </FieldSet>
    </Modal>
  );
};
