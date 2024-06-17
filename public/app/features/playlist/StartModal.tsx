import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue, UrlQueryMap, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Box, Button, Checkbox, Field, FieldSet, Modal, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';

import { Playlist, PlaylistMode } from './types';

export interface Props {
  playlist: Playlist;
  onDismiss: () => void;
}

export const StartModal = ({ playlist, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);
  const [mode, setMode] = useState<PlaylistMode>(false);
  const [autoFit, setAutofit] = useState(false);
  const [displayTimePicker, setDisplayTimePicker] = useState(true);
  const [displayVariables, setDisplayVariables] = useState(true);
  const [displayLinks, setDisplayLinks] = useState(true);

  const modes: Array<SelectableValue<PlaylistMode>> = [
    { label: 'Normal', value: false },
    { label: 'TV', value: 'tv' },
    { label: 'Kiosk', value: true },
  ];

  const onStart = () => {
    const params: UrlQueryMap = {};
    if (mode) {
      params.kiosk = mode;
    }
    if (autoFit) {
      params.autofitpanels = true;
    }

    if (!displayTimePicker) {
      params['_dash.hideTimePicker'] = true;
    }
    if (!displayVariables) {
      params['_dash.hideVariables'] = true;
    }
    if (!displayLinks) {
      params['_dash.hideLinks'] = true;
    }

    locationService.push(urlUtil.renderUrl(`/playlists/play/${playlist.uid}`, params));
  };

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
        {config.featureToggles.dashboardScene && (
          <Field label="Display dashboard controls" description="Customize dashboard elements visibility">
            <Box marginTop={2} marginBottom={2}>
              <Stack direction="column" alignItems="start" justifyContent="left" gap={2}>
                <Checkbox
                  label="Time and refresh"
                  name="displayTimePicker"
                  value={displayTimePicker}
                  onChange={(e) => setDisplayTimePicker(e.currentTarget.checked)}
                />
                <Checkbox
                  label="Variables"
                  name="displayVariableControls"
                  value={displayVariables}
                  onChange={(e) => setDisplayVariables(e.currentTarget.checked)}
                />
                <Checkbox
                  label="Dashboard links"
                  name="displayLinks"
                  value={displayLinks}
                  onChange={(e) => setDisplayLinks(e.currentTarget.checked)}
                />
              </Stack>
            </Box>
          </Field>
        )}
      </FieldSet>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={onStart}>
          Start {playlist.name}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    dashboardControlsList: css({
      padding: `${theme.spacing(2)} 0`,
    }),
  };
}
