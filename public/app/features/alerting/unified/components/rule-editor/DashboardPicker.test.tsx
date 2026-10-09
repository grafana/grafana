import { act } from '@testing-library/react';
import { noop } from 'lodash';
import { type Props } from 'react-virtualized-auto-sizer';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { AnnoKeyFolderTitle } from 'app/features/apiserver/types';

import { DashboardSearchItemType } from '../../../../search/types';
import { mockDashboardApi, setupMswServer } from '../../mockApi';
import { mockDashboardDto, mockDashboardSearchItem } from '../../mocks';

import { DashboardPicker, getDashboardFolderTitle, getDashboardTitle, getDashboardUid } from './DashboardPicker';
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
    // The dashboard mock is a v1 resource. New layouts select the v2 dashboard API, which rejects that shape.
    setTestFlags({ dashboardNewLayouts: false });
    mockDashboardApi(server).search([
      mockDashboardSearchItem({ uid: 'dash-1', type: DashboardSearchItemType.DashDB, title: 'Dashboard 1' }),
      mockDashboardSearchItem({ uid: 'dash-2', type: DashboardSearchItemType.DashDB, title: 'Dashboard 2' }),
      mockDashboardSearchItem({ uid: 'dash-3', type: DashboardSearchItemType.DashDB, title: 'Dashboard 3' }),
    ]);

    mockDashboardApi(server).dashboard(
      mockDashboardDto({
        uid: 'dash-2',
        title: 'Dashboard 2',
        panels: [
          {
            type: 'graph',
          },
          {
            type: 'timeseries',
          },
          // this one is a library panel
          {
            type: undefined,
            libraryPanel: {
              name: 'my library panel',
              uid: 'abc123',
            },
          },
        ],
      })
    );
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('Renders panels without ids', async () => {
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
});
