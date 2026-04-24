import { useState } from 'react';

import { type SelectableValue, type UrlQueryMap, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Box, Button, Checkbox, Field, FieldSet, Modal, RadioButtonGroup, Stack } from '@grafana/ui';

import { type Playlist } from '../../api/clients/playlist/v1';

import { type PlaylistMode } from './types';

export interface Props {
  playlist: Playlist;
  onDismiss: () => void;
}

export const StartModal = ({ playlist, onDismiss }: Props) => {
  const [mode, setMode] = useState<PlaylistMode>(false);
  const [autoFit, setAutofit] = useState(false);
  const [hideLogo, setHideLogo] = useState(false);
  const [displayTimePicker, setDisplayTimePicker] = useState(true);
  const [displayVariables, setDisplayVariables] = useState(true);
  const [displayLinks, setDisplayLinks] = useState(true);
  const [displayPlaylistNav, setDisplayPlaylistNav] = useState(true);

  const modes: Array<SelectableValue<PlaylistMode>> = [
    { label: t('playlist.start-modal.modes.label.normal', 'Normal'), value: false },
    { label: t('playlist.start-modal.modes.label.kiosk', 'Kiosk'), value: true },
  ];

  const onStart = () => {
    const params: UrlQueryMap = {};
    if (mode) {
      params.kiosk = mode;
    }
    if (autoFit) {
      params.autofitpanels = true;
    }
    if (hideLogo) {
      params.hideLogo = '1';
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
    if (!displayPlaylistNav) {
      params['_dash.hidePlaylistNav'] = true;
    }

    locationService.push(urlUtil.renderUrl(`/playlists/play/${playlist.metadata?.name}`, params));
    reportInteraction('grafana_kiosk_mode', {
      action: 'start_playlist',
      mode: mode,
    });
  };

  return (
    <Modal isOpen={true} title={t('playlist.start-modal.title-start-playlist', 'Start playlist')} onDismiss={onDismiss}>
      <FieldSet>
        <Stack direction="column" alignItems="start" justifyContent="left" gap={2}>
          <Field noMargin label={t('playlist.start-modal.label-mode', 'Mode')}>
            <RadioButtonGroup
              value={mode}
              options={modes}
              onChange={(v) => {
                setMode(v);
                if (!v) {
                  setHideLogo(false);
                }
              }}
            />
          </Field>
          <Field noMargin>
            <Checkbox
              label={t('playlist.start-modal.label-autofit', 'Autofit')}
              description={t(
                'playlist.start-modal.description-panel-heights-adjusted-screen',
                'Panel heights will be adjusted to fit screen size'
              )}
              name="autofix"
              value={autoFit}
              onChange={(e) => setAutofit(e.currentTarget.checked)}
            />
          </Field>
          {mode && (
            <Field noMargin>
              <Checkbox
                label={t('playlist.start-modal.label-hide-logo', 'Hide logo')}
                description={t(
                  'playlist.start-modal.description-hide-logo',
                  'Hide the branding footer from the dashboard'
                )}
                name="hideLogo"
                value={hideLogo}
                onChange={(e) => setHideLogo(e.currentTarget.checked)}
              />
            </Field>
          )}
          {config.featureToggles.dashboardNewLayouts && (
            <Field noMargin>
              <Checkbox
                label={t('playlist.start-modal.label-playlist-nav', 'Navigation buttons')}
                description={t(
                  'playlist.start-modal.description-playlist-nav',
                  'Show previous and next buttons to manually navigate between dashboards'
                )}
                name="displayPlaylistNav"
                value={displayPlaylistNav}
                onChange={(e) => setDisplayPlaylistNav(e.currentTarget.checked)}
              />
            </Field>
          )}
          <Field
            noMargin
            label={t('playlist.start-modal.label-display-dashboard-controls', 'Display dashboard controls')}
            description={t(
              'playlist.start-modal.description-customize-dashboard-elements-visibility',
              'Customize dashboard elements visibility'
            )}
          >
            <Box marginTop={2} marginBottom={2}>
              <Stack direction="column" alignItems="start" justifyContent="left" gap={2}>
                <Checkbox
                  label={t('playlist.start-modal.label-time-and-refresh', 'Time and refresh')}
                  name="displayTimePicker"
                  value={displayTimePicker}
                  onChange={(e) => setDisplayTimePicker(e.currentTarget.checked)}
                />
                <Checkbox
                  label={t('playlist.start-modal.label-variables', 'Variables')}
                  name="displayVariableControls"
                  value={displayVariables}
                  onChange={(e) => setDisplayVariables(e.currentTarget.checked)}
                />
                <Checkbox
                  label={t('playlist.start-modal.label-dashboard-links', 'Dashboard links')}
                  name="displayLinks"
                  value={displayLinks}
                  onChange={(e) => setDisplayLinks(e.currentTarget.checked)}
                />
              </Stack>
            </Box>
          </Field>
        </Stack>
      </FieldSet>
      <Modal.ButtonRow>
        <Button variant="primary" onClick={onStart}>
          <Trans i18nKey="playlist.start-modal.button-start" values={{ title: playlist.spec?.title }}>
            Start {'{{title}}'}
          </Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
