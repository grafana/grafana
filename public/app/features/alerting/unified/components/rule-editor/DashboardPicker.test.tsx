import { noop } from 'lodash';
import { type Props } from 'react-virtualized-auto-sizer';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { AnnoKeyFolderTitle } from 'app/features/apiserver/types';

import { DashboardSearchItemType } from '../../../../search/types';
import { mockDashboardApi, setupMswServer } from '../../mockApi';
import { mockDashboardDto, mockDashboardSearchItem, mockDashboardV2Dto } from '../../mocks';

import {
  DashboardPicker,
  getDashboardFolderTitle,
  getDashboardTitle,
  getDashboardUid,
  getVisualPanels,
} from './DashboardPicker';
import { type DashboardResponse } from './useDashboardQuery';

jest.mock('react-virtualized-auto-sizer', () => {
  return ({ children }: Props) =>
    children({
      height: 600,
      scaledHeight: 600,
      scaledWidth: 1,
      width: 1,
    });
});

const server = setupMswServer();

const ui = {
  dashboardButton: (name: RegExp) => byRole('button', { name }),
};

describe('DashboardPicker', () => {
  beforeEach(() => {
    mockDashboardApi(server).search([
      mockDashboardSearchItem({ uid: 'dash-1', type: DashboardSearchItemType.DashDB, title: 'Dashboard 1' }),
      mockDashboardSearchItem({ uid: 'dash-2', type: DashboardSearchItemType.DashDB, title: 'Dashboard 2' }),
      mockDashboardSearchItem({ uid: 'dash-3', type: DashboardSearchItemType.DashDB, title: 'Dashboard 3' }),
    ]);

    mockDashboardApi(server).dashboard(
      mockDashboardV2Dto({
        uid: 'dash-2',
        title: 'Dashboard 2',
        panels: [
          {
            id: 1,
            type: 'graph',
          },
          {
            id: 2,
            type: 'timeseries',
          },
          // this one is a library panel
          {
            id: 3,
            libraryPanel: {
              name: 'my library panel',
              uid: 'abc123',
            },
          },
        ],
      })
    );
  });

  it('Renders panels without titles', async () => {
    render(<DashboardPicker isOpen={true} onChange={noop} onDismiss={noop} dashboardUid="dash-2" panelId={2} />);

    expect(await ui.dashboardButton(/Dashboard 1/).find()).toBeInTheDocument();
    expect(ui.dashboardButton(/Dashboard 2/).get()).toBeInTheDocument();
    expect(ui.dashboardButton(/Dashboard 3/).get()).toBeInTheDocument();

    const panels = ui.dashboardButton(/<No title>/).getAll();
    expect(panels).toHaveLength(3);

    panels.forEach((panel) => {
      expect(panel).toBeEnabled();
    });
  });
  it('reads title, uid, and folder from a v2 resource', () => {
    const dashboard = {
      kind: 'DashboardWithAccessInfo',
      metadata: {
        name: 'dash-uid',
        annotations: { [AnnoKeyFolderTitle]: 'Ops folder' },
      },
      spec: { title: 'Ops dashboard', elements: {} },
    } as DashboardResponse;

    expect(getDashboardTitle(dashboard)).toBe('Ops dashboard');
    expect(getDashboardUid(dashboard)).toBe('dash-uid');
    expect(getDashboardFolderTitle(dashboard)).toBe('Ops folder');
  });

  it('reads title, uid, and folder from a legacy dashboard', () => {
    const dashboard = {
      dashboard: { title: 'Legacy dashboard', uid: 'legacy-uid' },
      meta: { folderTitle: 'Legacy folder' },
    } as DashboardResponse;

    expect(getDashboardTitle(dashboard)).toBe('Legacy dashboard');
    expect(getDashboardUid(dashboard)).toBe('legacy-uid');
    expect(getDashboardFolderTitle(dashboard)).toBe('Legacy folder');
  });

  it('does not list rows as panels in a legacy dashboard', () => {
    const dashboard = mockDashboardDto({
      panels: [
        { id: 1, title: 'Row panel', type: 'row' },
        { id: 2, title: 'First panel', type: 'timeseries' },
      ],
    });

    expect(getVisualPanels(dashboard).map((panel) => panel.title)).toEqual(['First panel']);
  });

  it('lists panels within collapsed rows of a legacy dashboard', () => {
    const dashboard = mockDashboardDto({
      panels: [
        { id: 1, title: 'First panel', type: 'timeseries' },
        {
          id: 2,
          title: 'Row panel',
          collapsed: true,
          type: 'row',
          panels: [{ id: 3, title: 'Panel within collapsed row', type: 'timeseries' }],
        },
      ],
    });

    expect(getVisualPanels(dashboard).map((panel) => panel.title)).toEqual([
      'First panel',
      'Panel within collapsed row',
    ]);
  });
});
