import React, { useState } from 'react';
import { PlaylistDTO } from './types';
import {
  Button,
  Card,
  Checkbox,
  ClipboardButton,
  Field,
  FieldSet,
  Icon,
  Input,
  LinkButton,
  Modal,
  ModalsController,
  RadioButtonGroup,
  useStyles2,
} from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AppEvents, GrafanaTheme2, SelectableValue, UrlQueryMap, urlUtil } from '@grafana/data';
import { css } from '@emotion/css';
import { DashNavButton } from '../dashboard/components/DashNav/DashNavButton';
import appEvents from 'app/core/app_events';
import { buildBaseUrl } from '../dashboard/components/ShareModal/utils';

interface Props {
  setStartPlaylist: (playlistItem: PlaylistDTO) => void;
  setPlaylistToDelete: (playlistItem: PlaylistDTO) => void;
  playlists: PlaylistDTO[] | undefined;
}

interface ShareModalProps {
  playlistId: number;
  onDismiss: () => void;
}

type PlaylistModes = boolean | 'tv';

const PlaylistShareModal = ({ playlistId, onDismiss }: ShareModalProps) => {
  const [mode, setMode] = useState<PlaylistModes>(false);
  const [autoFit, setAutofit] = useState(false);

  const modes: Array<SelectableValue<PlaylistModes>> = [
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

export const PlaylistPageList = ({ playlists, setStartPlaylist, setPlaylistToDelete }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <ul className={styles.list}>
      {playlists!.map((playlist: PlaylistDTO) => (
        <li className={styles.listItem} key={playlist.id.toString()}>
          <Card>
            <Card.Heading>
              {playlist.name}
              <ModalsController key="button-share">
                {({ showModal, hideModal }) => (
                  <DashNavButton
                    tooltip="Share playlist"
                    icon="share-alt"
                    iconSize="lg"
                    onClick={() => {
                      showModal(PlaylistShareModal, {
                        playlistId: playlist.id,
                        onDismiss: hideModal,
                      });
                    }}
                  />
                )}
              </ModalsController>
            </Card.Heading>
            <Card.Actions>
              <Button variant="secondary" icon="play" onClick={() => setStartPlaylist(playlist)}>
                Start playlist
              </Button>
              {contextSrv.isEditor && (
                <>
                  <LinkButton key="edit" variant="secondary" href={`/playlists/edit/${playlist.id}`} icon="cog">
                    Edit playlist
                  </LinkButton>
                  <Button
                    disabled={false}
                    onClick={() => setPlaylistToDelete({ id: playlist.id, name: playlist.name })}
                    icon="trash-alt"
                    variant="destructive"
                  >
                    Delete playlist
                  </Button>
                </>
              )}
            </Card.Actions>
          </Card>
        </li>
      ))}
    </ul>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      display: 'grid',
    }),
    listItem: css({
      listStyle: 'none',
    }),
  };
}
