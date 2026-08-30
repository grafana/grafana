import { useId, useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Box, Button, Field, FieldSet, Input, LinkButton, Stack } from '@grafana/ui';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { Form } from 'app/core/components/Form/Form';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { RepositorySelect } from 'app/features/provisioning/components/Shared/RepositorySelect';
import { getManagerIdentity, isManagedByRepository } from 'app/features/provisioning/utils/managedResource';

import { type Playlist, type PlaylistSpec } from '../../api/clients/playlist/v1';
import { getGrafanaSearcher } from '../search/service/searcher';

import { PlaylistTable } from './PlaylistTable';
import { usePlaylistItems } from './usePlaylistItems';

interface Props {
  onSubmit: (playlist: Playlist) => void | Promise<void>;
  playlist: Playlist;
  /** Renders a repository selector at the top of the form. */
  showRepositorySelect?: boolean;
  /** Repositories to choose from (may be empty). */
  repositories?: RepositoryView[];
  /** Selected repository name. Empty string = "no repository" (save to Grafana). */
  selectedRepository?: string;
  onRepositoryChange?: (repositoryName: string) => void;
  /**
   * Locks the repository selector (the repository can't be changed after creation). The displayed
   * value is then derived from the playlist itself rather than `selectedRepository`.
   */
  disableRepositorySelect?: boolean;
}

export const PlaylistForm = ({
  onSubmit,
  playlist,
  showRepositorySelect,
  repositories = [],
  selectedRepository,
  onRepositoryChange,
  disableRepositorySelect,
}: Props) => {
  const [saving, setSaving] = useState(false);
  const playlistNameId = useId();
  const playlistIntervalId = useId();
  const { title: name, interval, items: propItems } = playlist.spec || {};
  const tagOptions = useMemo(() => {
    return () => getGrafanaSearcher().tags({ kind: ['dashboard'] });
  }, []);

  const { items, addByUID, addByTag, deleteItem, moveItem } = usePlaylistItems(propItems);

  // When the selector is locked the repository can't be changed, so derive the value from the
  // playlist (its managing repository, or "no repository" when unmanaged). Otherwise it's controlled.
  const repositoryFieldValue = disableRepositorySelect
    ? isManagedByRepository(playlist)
      ? (getManagerIdentity(playlist) ?? '')
      : ''
    : selectedRepository; // undefined leaves nothing selected (placeholder)

  const doSubmit = async (specUpdates: Playlist['spec']) => {
    setSaving(true);
    // Strip UI-only properties (dashboards) from items before submission
    const apiItems = items.map(({ dashboards, ...item }) => item);
    try {
      // The direct-save path navigates away; the provisioned path returns after opening the drawer,
      // so reset `saving` here or the Save button would keep spinning behind the drawer.
      await onSubmit({
        ...playlist,
        spec: {
          ...specUpdates,
          interval: specUpdates?.interval ?? '5m',
          title: specUpdates?.title ?? '',
          items: apiItems,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form<PlaylistSpec> onSubmit={doSubmit} validateOn={'onBlur'}>
      {({ register, errors }) => {
        const isDisabled = items.length === 0 || Object.keys(errors).length > 0;
        return (
          <>
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

            {showRepositorySelect && (
              // RepositorySelect uses noMargin (shared component); add bottom spacing to match the
              // surrounding fields and keep it from butting against the "Add dashboards" section.
              <Box marginBottom={2}>
                <RepositorySelect
                  repositories={repositories}
                  value={repositoryFieldValue}
                  // readOnly already disables the Combobox, so onChange can't fire when locked.
                  onChange={onRepositoryChange ?? (() => {})}
                  readOnly={disableRepositorySelect}
                />
              </Box>
            )}

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
