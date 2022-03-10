import { dataFrameFromJSON, DataFrameJSON, DataFrameView } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Card, CustomScrollbar, Icon } from '@grafana/ui';
import { Breadcrumb } from 'app/features/storage/Breadcrumb';
import React from 'react';
import { DashboardModel } from '../../state/DashboardModel';

type Props = {
  dashboard: DashboardModel;
};

interface FolderListItem {
  name: string;
  path: string; // without .json
  mediaType: string;
}

export const FolderView = ({ dashboard }: Props) => {
  const history = locationService.getHistory();
  const location = locationService.getLocation();
  const firstPanel = dashboard.panels[0];
  const frameJSON = (firstPanel as any)?.__listing as DataFrameJSON;
  if (!frameJSON) {
    console.log('GOT', dashboard);
    return <div>Missing folder listing ¯\_(ツ)_/¯ </div>;
  }
  const view = new DataFrameView<FolderListItem>(dataFrameFromJSON(frameJSON));

  return (
    <div>
      <Breadcrumb pathName={location.pathname} onPathChange={(changedPath) => history.push(changedPath)} />
      <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true} updateAfterMountMs={500}>
        <div>
          {view.map((item) => {
            const url = `/g${item.path}`;
            return (
              <Card key={item.name} heading={item.name} href={url}>
                <Card.Figure>
                  <Icon name={item.mediaType === 'directory' ? 'folder' : 'gf-grid'} size="sm" />
                </Card.Figure>
              </Card>
            );
          })}
        </div>
      </CustomScrollbar>
    </div>
  );
};
