import 'whatwg-fetch';
import { waitFor } from '@testing-library/dom';
import { merge } from 'lodash';
import { http, HttpResponse } from 'msw';
import { setupServer, SetupServerApi } from 'msw/node';

import { setBackendSrv } from '@grafana/runtime';
import { SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';

import { LibraryVizPanel } from './LibraryVizPanel';
import { PanelRepeaterGridItem } from './PanelRepeaterGridItem';

describe('LibraryVizPanel', () => {
  const server = setupServer();

  beforeAll(() => {
    setBackendSrv(backendSrv);
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  it('should fetch and init', async () => {
    setUpApiMock(server);
    const libVizPanel = new LibraryVizPanel({
      name: 'My Library Panel',
      title: 'Panel title',
      uid: 'fdcvggvfy2qdca',
      panelKey: 'lib-panel',
    });
    libVizPanel.activate();
    await waitFor(() => {
      expect(libVizPanel.state.panel).toBeInstanceOf(VizPanel);
    });
  });

  it('should change parent from SceneGridItem to PanelRepeaterGridItem if repeat is set', async () => {
    setUpApiMock(server, { model: { repeat: 'query0', repeatDirection: 'h' } });
    const libVizPanel = new LibraryVizPanel({
      name: 'My Library Panel',
      title: 'Panel title',
      uid: 'fdcvggvfy2qdca',
      panelKey: 'lib-panel',
    });

    const layout = new SceneGridLayout({
      children: [new SceneGridItem({ body: libVizPanel })],
    });
    layout.activate();
    libVizPanel.activate();
    await waitFor(() => {
      expect(layout.state.children[0]).toBeInstanceOf(PanelRepeaterGridItem);
    });
  });
});

function setUpApiMock(
  server: SetupServerApi,
  overrides: Omit<Partial<LibraryPanel>, 'model'> & { model?: Partial<LibraryPanel['model']> } = {}
) {
  const libPanel: LibraryPanel = merge(
    {
      folderUid: 'general',
      uid: 'fdcvggvfy2qdca',
      name: 'My Library Panel',
      type: 'timeseries',
      description: '',
      model: {
        datasource: {
          type: 'grafana-testdata-datasource',
          uid: 'PD8C576611E62080A',
        },
        description: '',

        maxPerRow: 4,
        options: {
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'bottom',
            showLegend: true,
          },
          tooltip: {
            maxHeight: 600,
            mode: 'single',
            sort: 'none',
          },
        },
        targets: [
          {
            datasource: {
              type: 'grafana-testdata-datasource',
              uid: 'PD8C576611E62080A',
            },
            refId: 'A',
          },
        ],
        title: 'Panel Title',
        type: 'timeseries',
      },
      version: 6,
      meta: {
        folderName: 'General',
        folderUid: '',
        connectedDashboards: 1,
        created: '2024-02-15T15:26:46Z',
        updated: '2024-02-28T15:54:22Z',
        createdBy: {
          avatarUrl: '/avatar/46d229b033af06a191ff2267bca9ae56',
          id: 1,
          name: 'admin',
        },
        updatedBy: {
          avatarUrl: '/avatar/46d229b033af06a191ff2267bca9ae56',
          id: 1,
          name: 'admin',
        },
      },
    },
    overrides
  );

  const libPanelMock: { result: LibraryPanel } = {
    result: libPanel,
  };

  server.use(http.get('/api/library-elements/:uid', () => HttpResponse.json(libPanelMock)));
}
