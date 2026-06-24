import { useId, useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, LinkButton, Stack } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { Form } from 'app/core/components/Form/Form';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { RepositorySelect } from 'app/features/provisioning/components/Shared/RepositorySelect';

import { type Playlist, type PlaylistSpec } from '../../api/clients/playlist/v1';
import { getGrafanaSearcher } from '../search/service/searcher';

import { PlaylistTable } from './PlaylistTable';
import { usePlaylistItems } from './usePlaylistItems';

/** Repository selection for saving the playlist to a provisioning repository. */
export interface PlaylistRepositorySelect {
  /** Configured repositories to choose from (may be empty). */
  repositories: RepositoryView[];
  /** Selected repository name. Empty string = "no repository" (save to Grafana). */
  value: string;
  onChange: (repositoryName: string) => void;
  /** When true the selection is fixed — the edit page does not allow changing the repository. */
  readOnly?: boolean;
}

interface Props {
  onSubmit: (playlist: Playlist) => void;
  playlist: Playlist;
  /** When provided, renders a repository selector at the top of the form. */
  repositorySelect?: PlaylistRepositorySelect;
}

export const PlaylistForm = ({ onSubmit, playlist, repositorySelect }: Props) => {
  const [saving, setSaving] = useState(false);
  const playlistNameId = useId();
  const playlistIntervalId = useId();
  const { title: name, interval, items: propItems } = playlist.spec || {};
  const tagOptions = useMemo(() => {
    return () => getGrafanaSearcher().tags({ kind: ['dashboard'] });
  }, []);

  const { items, addByUID, addByTag, deleteItem, moveItem } = usePlaylistItems(propItems);

  const doSubmit = (specUpdates: Playlist['spec']) => {
    setSaving(true);
    // Strip UI-only properties (dashboards) from items before submission
    const apiItems = items.map(({ dashboards, ...item }) => item);
    onSubmit({
      ...playlist,
      spec: {
        ...specUpdates,
        interval: specUpdates?.interval ?? '5m',
        title: specUpdates?.title ?? '',
        items: apiItems,
      },
    });
  };

  return (
    <Form<PlaylistSpec> onSubmit={doSubmit} validateOn={'onBlur'}>
      {({ register, errors }) => {
        const isDisabled = items.length === 0 || Object.keys(errors).length > 0;
        return (
          <>
            {repositorySelect && (
              <RepositorySelect
                repositories={repositorySelect.repositories}
                value={repositorySelect.value}
                onChange={repositorySelect.onChange}
                includeNoneOption
                readOnly={repositorySelect.readOnly}
              />
            )}
            <Field
              label={t('playlist-edit.form.name-label', 'Name')}
              invalid={!!errors.title}
              error={errors?.title?.message}
            >
              <Input
                type="text"
                {...register('title', { required: t('playlist-edit.form.name-required', 'Name is required') })}
                placeholder={t('playlist-edit.form.name-placeholder', 'Name')}
                defaultValue={name}
                data-testid={selectors.pages.PlaylistForm.name}
                id={playlistNameId}
              />
            </Field>
            <Field
              label={t('playlist-edit.form.interval-label', 'Interval')}
              invalid={!!errors.interval}
              error={errors?.interval?.message}
            >
              <Input
                type="text"
                {...register('interval', {
                  required: t('playlist-edit.form.interval-required', 'Interval is required'),
                })}
                placeholder={t('playlist-edit.form.interval-placeholder', '5m')}
                defaultValue={interval ?? '5m'}
                data-testid={selectors.pages.PlaylistForm.interval}
                id={playlistIntervalId}
              />
            </Field>

            <PlaylistTable items={items} deleteItem={deleteItem} moveItem={moveItem} />

            <FieldSet label={t('playlist-edit.form.heading', 'Add dashboards')}>
              <Field label={t('playlist-edit.form.add-title-label', 'Add by title')}>
                <DashboardPicker id="dashboard-picker" onChange={addByUID} key={items.length} />
              </Field>

              <Field label={t('playlist-edit.form.add-tag-label', 'Add by tag')}>
                <TagFilter
                  isClearable
                  tags={[]}
                  hideValues
                  tagOptions={tagOptions}
                  onChange={addByTag}
                  placeholder={t('playlist-edit.form.add-tag-placeholder', 'Select a tag')}
                />
              </Field>
            </FieldSet>

            <Stack>
              <Button type="submit" variant="primary" disabled={isDisabled} icon={saving ? 'spinner' : undefined}>
                <Trans i18nKey="playlist-edit.form.save">Save</Trans>
              </Button>
              <LinkButton variant="secondary" href={`${config.appSubUrl}/playlists`}>
                <Trans i18nKey="playlist-edit.form.cancel">Cancel</Trans>
              </LinkButton>
            </Stack>
          </>
        );
      }}
    </Form>
  );
};
