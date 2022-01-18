import React, { FC, useState } from 'react';
import { AppEvents, SelectableValue, UrlQueryMap, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PlaylistDTO } from './types';
import { Button, Checkbox, ClipboardButton, Field, FieldSet, Icon, Input, Modal, RadioButtonGroup } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { buildBaseUrl } from '../dashboard/components/ShareModal/utils';

export interface Props {
  playlist: PlaylistDTO;
  onDismiss: () => void;
  showStartButton?: boolean;
}

export const PlaylistSettingsModal: FC<Props> = ({ playlist, onDismiss, showStartButton }) => {
  const [mode, setMode] = useState<any>(false);
  const [autoFit, setAutofit] = useState(false);

  const modes: Array<SelectableValue<any>> = [
    { label: 'Normal', value: false },
    { label: 'TV', value: 'tv' },
    { label: 'Kiosk', value: true },
  ];

  const onStart = () => {
    const params: any = {};
    if (mode) {
      params.kiosk = mode;
    }
    if (autoFit) {
      params.autofitpanels = true;
    }
    locationService.push(urlUtil.renderUrl(`/playlists/play/${playlist.id}`, params));
  };

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

  const shareUrl = urlUtil.renderUrl(`${buildBaseUrl()}/play/${playlist.id}`, params);

  return (
    <Modal isOpen={true} icon="play" title="Start playlist" onDismiss={onDismiss}>
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
      {showStartButton && (
        <Modal.ButtonRow>
          <Button variant="primary" onClick={onStart}>
            Start {playlist.name}
          </Button>
        </Modal.ButtonRow>
      )}
    </Modal>
  );
};
