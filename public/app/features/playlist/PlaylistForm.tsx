import React, { useMemo, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Button, Field, Form, HorizontalGroup, Input, LinkButton } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { Trans, t } from 'app/core/internationalization';

import { getGrafanaSearcher } from '../search/service';

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
    onSubmit({ ...list, items });
  };

  return (
    <div>
      <Form onSubmit={doSubmit} validateOn={'onBlur'}>
        {({ register, errors }) => {
          const isDisabled = items.length === 0 || Object.keys(errors).length > 0;
          return (
            <>
              <Field
                label={t('playlist-form.label.name', 'Name')}
                invalid={!!errors.name}
                error={errors?.name?.message}
              >
                <Input
                  type="text"
                  {...register('name', { required: t('playlist-form.required.name', 'Name is required') })}
                  placeholder={t('playlist-form.placeholder.name', 'Name')}
                  defaultValue={name}
                  aria-label={selectors.pages.PlaylistForm.name}
                />
              </Field>
              <Field
                label={t('playlist-form.label.interval', 'Interval')}
                invalid={!!errors.interval}
                error={errors?.interval?.message}
              >
                <Input
                  type="text"
                  {...register('interval', { required: t('playlist-form.required.interval', 'Interval is required') })}
                  placeholder={t('playlist-form.placeholder.interval', '5m')}
                  defaultValue={interval ?? '5m'}
                  aria-label={selectors.pages.PlaylistForm.interval}
                />
              </Field>

              <PlaylistTable items={items} deleteItem={deleteItem} moveItem={moveItem} />

              <div className="gf-form-group">
                <h3 className="page-headering">
                  <Trans i18nKey="playlist-form.heading">Add dashboards</Trans>
                </h3>

                <Field label={t('playlist-form.label.title', 'Add by title')}>
                  <DashboardPicker id="dashboard-picker" onChange={addByUID} key={items.length} />
                </Field>

                <Field label={t('playlist-form.label.tag', 'Add by tag')}>
                  <TagFilter
                    isClearable
                    tags={[]}
                    hideValues
                    tagOptions={tagOptions}
                    onChange={addByTag}
                    placeholder={t('playlist-form.placeholder.tag', 'Select a tag')}
                  />
                </Field>
              </div>

              <HorizontalGroup>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isDisabled}
                  icon={saving ? 'fa fa-spinner' : undefined}
                >
                  <Trans i18nKey="playlist-form.save">Save</Trans>
                </Button>
                <LinkButton variant="secondary" href={`${config.appSubUrl}/playlists`}>
                  <Trans i18nKey="playlist-form.cancel">Cancel</Trans>
                </LinkButton>
              </HorizontalGroup>
            </>
          );
        }}
      </Form>
    </div>
  );
};
