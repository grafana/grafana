import React, { FC } from 'react';
import { connect, MapStateToProps } from 'react-redux';
import { NavModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, Field, Form, HorizontalGroup, Input, LinkButton } from '@grafana/ui';

import Page from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';
import { GrafanaRouteComponentProps } from '../../core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { DashboardPicker } from '../../core/components/Select/DashboardPicker';
import { TagFilter } from '../../core/components/TagFilter/TagFilter';
import { SearchSrv } from '../../core/services/search_srv';
import { PlaylistListItemProvider } from './PlaylistListItemProvider';
import { PlaylistTable } from './PlaylistTable';

interface ConnectedProps {
  navModel: NavModel;
}

interface PlaylistFields {
  name: string;
  interval: string;
}

interface Props extends ConnectedProps, GrafanaRouteComponentProps {}

const searchSrv = new SearchSrv();

export const PlaylistNewPage: FC<Props> = ({ navModel }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={false}>
        <div className="page-container page-body" ng-form="ctrl.playlistEditForm">
          <h3 className="page-sub-heading" ng-show="ctrl.isNew">
            New Playlist
          </h3>

          <p className="playlist-description">
            A playlist rotates through a pre-selected list of Dashboards. A Playlist can be a great way to build
            situational awareness, or just show off your metrics to your team or visitors.
          </p>

          <Form onSubmit={(items: PlaylistFields) => {}}>
            {({ register, errors, getValues }) => {
              return (
                <>
                  <Field label="Name" invalid={!!errors.name} error={errors?.name?.message}>
                    <Input type="text" name="name" ref={register({ required: 'Name is required' })} />
                  </Field>
                  <Field label="Interval" invalid={!!errors.interval} error={errors?.interval?.message}>
                    <Input
                      type="text"
                      name="interval"
                      ref={register({ required: 'Interval is required' })}
                      placeholder="5m"
                    />
                  </Field>

                  <PlaylistListItemProvider>
                    {({ items, addByTag, addById, remove, moveDown, moveUp }) => {
                      return (
                        <>
                          <PlaylistTable items={items} onMoveUp={moveUp} onMoveDown={moveDown} onDelete={remove} />
                          <div className="gf-form-group">
                            <h3 className="page-headering">Add dashboards</h3>

                            <Field label="Add by title">
                              <DashboardPicker onChange={addById} />
                            </Field>

                            <Field label="Add by tag">
                              <TagFilter
                                isClearable
                                tags={[]}
                                hideValues
                                tagOptions={searchSrv.getDashboardTags}
                                onChange={addByTag}
                                placeholder={''}
                              />
                            </Field>
                          </div>

                          <HorizontalGroup>
                            <Button variant="primary" disabled={items.length === 0 || Object.keys(errors).length > 0}>
                              Create
                            </Button>
                            <LinkButton variant="secondary" href={`${config.appSubUrl}/playlists`}>
                              Cancel
                            </LinkButton>
                          </HorizontalGroup>
                        </>
                      );
                    }}
                  </PlaylistListItemProvider>
                </>
              );
            }}
          </Form>
        </div>
        <footer />
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, {}, StoreState> = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'playlists'),
});

export default connect(mapStateToProps)(PlaylistNewPage);
