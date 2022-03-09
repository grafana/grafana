import { dataFrameFromJSON, DataFrameJSON, DataFrameView } from '@grafana/data';
import { Card, CustomScrollbar, Icon } from '@grafana/ui';
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
  const firstPanel = dashboard.panels[0];
  const frameJSON = (firstPanel as any)?.__listing as DataFrameJSON;
  if (!frameJSON) {
    console.log('GOT', dashboard);
    return <div>Missing folder listing ¯\_(ツ)_/¯ </div>;
  }
  const parts = ((dashboard.meta as any).slug as string).split('/');
  const view = new DataFrameView<FolderListItem>(dataFrameFromJSON(frameJSON));

  return (
    <div>
      <div>
        <pre>NAVIGATE: {JSON.stringify(parts)}</pre>
      </div>
      <div>
        <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true} updateAfterMountMs={500}>
          <div>
            {view.map((item) => {
              const url = `/g${item.path}`;
              return (
                <Card
                  key={item.name}
                  heading={item.name}
                  onClick={() => {
                    // HACK! setting href not working???
                    window.location.href = url;
                  }}
                >
                  <Card.Figure>
                    <Icon name={item.mediaType === 'directory' ? 'folder' : 'gf-grid'} size="sm" />
                  </Card.Figure>
                </Card>
              );
            })}
          </div>
        </CustomScrollbar>
      </div>
    </div>
  );
};
