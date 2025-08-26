import { noop } from 'lodash';
import { Props } from 'react-virtualized-auto-sizer';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { DashboardSearchItemType } from '../../../../search/types';
import { mockDashboardApi, setupMswServer } from '../../mockApi';
import { mockDashboardDto, mockDashboardSearchItem } from '../../mocks';

import { DashboardPicker } from './DashboardPicker';

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
});
