import React, { FC, useState } from 'react';
import { SelectableValue, urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PlaylistDTO, PlaylistMode } from './types';
import { Button, Checkbox, Field, FieldSet, Modal, RadioButtonGroup } from '@grafana/ui';

export interface StartModalProps {
  playlist: PlaylistDTO;
  onDismiss: () => void;
}

export const StartModal: FC<StartModalProps> = ({ playlist, onDismiss }) => {
  const [mode, setMode] = useState<PlaylistMode>(false);
  const [autoFit, setAutofit] = useState(false);

  const modes: Array<SelectableValue<PlaylistMode>> = [
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

  return (
    <Modal isOpen={true} icon="play" title="Start playlist" onDismiss={onDismiss}>
      <FieldSet>
        <Field label="Mode">
          <RadioButtonGroup value={mode} options={modes} onChange={setMode} />
        </Field>
        <Checkbox
          label="Autofit"
          description="Panel heights will be adjusted to fit screen size"
          name="autofix"
          value={autoFit}
          onChange={(e) => setAutofit(e.currentTarget.checked)}
        />
      </FieldSet>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={onStart}>
          Start {playlist.name}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
