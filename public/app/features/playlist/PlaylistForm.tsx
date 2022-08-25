import React, { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Button, Field, Form, HorizontalGroup, Input, LinkButton } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';

import { getGrafanaSearcher } from '../search/service';

import { PlaylistTable } from './PlaylistTable';
import { Playlist } from './types';
import { usePlaylistItems } from './usePlaylistItems';

interface Props {
  onSubmit: (playlist: Playlist) => void;
  playlist: Playlist;
}

export const PlaylistForm = ({ onSubmit, playlist }: Props) => {
  const { name, interval, items: propItems } = playlist;
  const tagOptions = useMemo(() => {
    return () => getGrafanaSearcher().tags({ kind: ['dashboard'] });
  }, []);

  const { items, addById, addByTag, deleteItem, moveItem } = usePlaylistItems(propItems);

  return (
    <div>
      <Form onSubmit={(list: Playlist) => onSubmit({ ...list, items })} validateOn={'onBlur'}>
        {({ register, errors }) => {
          const isDisabled = items.length === 0 || Object.keys(errors).length > 0;
          return (
            <>
              <Field label="Name" invalid={!!errors.name} error={errors?.name?.message}>
                <Input
                  type="text"
                  {...register('name', { required: 'Name is required' })}
                  placeholder="Name"
                  defaultValue={name}
                  aria-label={selectors.pages.PlaylistForm.name}
                />
              </Field>
              <Field label="Interval" invalid={!!errors.interval} error={errors?.interval?.message}>
                <Input
                  type="text"
                  {...register('interval', { required: 'Interval is required' })}
                  placeholder="5m"
                  defaultValue={interval ?? '5m'}
                  aria-label={selectors.pages.PlaylistForm.interval}
                />
              </Field>

              <PlaylistTable items={items} deleteItem={deleteItem} moveItem={moveItem} />

              <div className="gf-form-group">
                <h3 className="page-headering">Add dashboards</h3>

                <Field label="Add by title">
                  <DashboardPicker id="dashboard-picker" onChange={addById} key={items.length} />
                </Field>

                <Field label="Add by tag">
                  <TagFilter
                    isClearable
                    tags={[]}
                    hideValues
                    tagOptions={tagOptions}
                    onChange={addByTag}
                    placeholder="Select a tag"
                  />
                </Field>
              </div>

              <HorizontalGroup>
                <Button type="submit" variant="primary" disabled={isDisabled}>
                  Save
                </Button>
                <LinkButton variant="secondary" href={`${config.appSubUrl}/playlists`}>
                  Cancel
                </LinkButton>
              </HorizontalGroup>
            </>
          );
        }}
      </Form>
    </div>
  );
};
