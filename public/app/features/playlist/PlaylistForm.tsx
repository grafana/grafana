import { useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, LinkButton, Stack } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { Trans, t } from 'app/core/internationalization';

import { getGrafanaSearcher } from '../search/service/searcher';

import { PlaylistTable } from './PlaylistTable';
import { Playlist } from './types';
import { usePlaylistItems } from './usePlaylistItems';

interface Props {
  onSubmit: (playlist: Playlist) => void;
  playlist: Playlist;
}

export const PlaylistForm = ({ onSubmit, playlist }: Props) => {
  const [saving, setSaving] = useState(false);
  const { name, interval, items: propItems } = playlist;
  const tagOptions = useMemo(() => {
    return () => getGrafanaSearcher().tags({ kind: ['dashboard'] });
  }, []);

  const { items, addByUID, addByTag, deleteItem, moveItem } = usePlaylistItems(propItems);

  const doSubmit = (list: Playlist) => {
    setSaving(true);
    onSubmit({ ...list, items, uid: playlist.uid });
  };

  return (
    <Form onSubmit={doSubmit} validateOn={'onBlur'}>
      {({ register, errors }) => {
        const isDisabled = items.length === 0 || Object.keys(errors).length > 0;
        return (
          <>
            <Field
              label={t('playlist-edit.form.name-label', 'Name')}
              invalid={!!errors.name}
              error={errors?.name?.message}
            >
              <Input
                type="text"
                {...register('name', { required: t('playlist-edit.form.name-required', 'Name is required') })}
                placeholder={t('playlist-edit.form.name-placeholder', 'Name')}
                defaultValue={name}
                aria-label={selectors.pages.PlaylistForm.name}
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
                aria-label={selectors.pages.PlaylistForm.interval}
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
