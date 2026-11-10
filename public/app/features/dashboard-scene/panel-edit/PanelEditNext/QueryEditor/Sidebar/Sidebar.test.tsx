import { act, screen } from '@testing-library/react';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { SidebarSize } from '../../constants';
import { ds1SettingsMock, renderWithQueryEditorProvider } from '../testUtils';

import { Sidebar } from './Sidebar';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: () => ds1SettingsMock,
  }),
}));

describe('QueryEditorSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
    jest.restoreAllMocks();
  });

  describe('button labels experiment', () => {
    it.each([false, true])('labels both section header add buttons when the flag is %s', (flagValue) => {
      setTestFlags({ [FlagKeys.PaneleditButtonLabels]: flagValue });

      renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />);

      expect(screen.getByRole('button', { name: 'Add query' })).toHaveTextContent(/^Add$/);
      expect(screen.getByRole('button', { name: 'Add transformation' })).toHaveTextContent(/^Add$/);
    });
  });

  describe('header view toggle at narrow widths', () => {
    // jsdom does no layout; drive the header's overflow measurement via the prototype getters.
    function mockMeasuredWidths({ contentWidth, containerWidth }: { contentWidth: number; containerWidth: number }) {
      jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(contentWidth);
      jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(containerWidth);
    }

    it('shows tab labels when the toggle fits', () => {
      mockMeasuredWidths({ contentWidth: 150, containerWidth: 200 });
      renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Mini} setSidebarSize={jest.fn()} />);

      expect(screen.getByRole('radio', { name: 'Data' })).toHaveTextContent('Data');
    });

    it('drops tab labels but keeps accessible names when the toggle overflows', () => {
      mockMeasuredWidths({ contentWidth: 150, containerWidth: 100 });
      renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Mini} setSidebarSize={jest.fn()} />);

      const dataTab = screen.getByRole('radio', { name: 'Data' });
      expect(dataTab).not.toHaveTextContent('Data');
    });
  });

  it('does not render bulk actions bar when fewer than 2 items are selected', () => {
    // Default state has no items selected (selectedQueryRefIds = [], selectedTransformationIds = [])
    renderWithQueryEditorProvider(<Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={jest.fn()} />);

    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();
  });

  it('should call setSidebarSize with Full when toggling from Mini', async () => {
    const setSidebarSize = jest.fn();
    const { user } = renderWithQueryEditorProvider(
      <Sidebar sidebarSize={SidebarSize.Mini} setSidebarSize={setSidebarSize} />
    );

    await user.click(screen.getByRole('button', { name: /toggle sidebar size/i }));

    expect(setSidebarSize).toHaveBeenCalledWith(SidebarSize.Full);
  });

  it('should call setSidebarSize with Mini when toggling from Full', async () => {
    const setSidebarSize = jest.fn();
    const { user } = renderWithQueryEditorProvider(
      <Sidebar sidebarSize={SidebarSize.Full} setSidebarSize={setSidebarSize} />
    );

    await user.click(screen.getByRole('button', { name: /toggle sidebar size/i }));

    expect(setSidebarSize).toHaveBeenCalledWith(SidebarSize.Mini);
  });
});
