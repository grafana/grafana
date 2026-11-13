import { fireEvent, screen } from '@testing-library/react';

import { InspectTab } from 'app/features/inspector/types';

import { QueryEditorType } from '../../constants';
import { QueryEditorDetailsSidebar } from '../Body/QueryEditorDetailsSidebar';
import { mockQueryOptionsState, renderWithQueryEditorProvider } from '../testUtils';
import { QueryOptionField } from '../types';

import { QueryOptionsBar } from './QueryOptionsBar';

const trackQueryMenuAction = jest.fn();
const trackQueryOptionsToggle = jest.fn();
const getDashboardSceneFor = jest.fn();
const panelInspectDrawerMock = jest.fn().mockImplementation((args) => ({ kind: 'panel-inspect-drawer', args }));

jest.mock('../../tracking', () => ({
  trackQueryMenuAction: (...args: unknown[]) => trackQueryMenuAction(...args),
  trackQueryOptionsToggle: (...args: unknown[]) => trackQueryOptionsToggle(...args),
}));

jest.mock('../../../../utils/utils', () => ({
  getDashboardSceneFor: (...args: unknown[]) => getDashboardSceneFor(...args),
}));

jest.mock('../../../../inspect/PanelInspectDrawer', () => ({
  PanelInspectDrawer: function PanelInspectDrawer(...args: unknown[]) {
    return panelInspectDrawerMock(...args);
  },
}));

describe('QueryOptionsBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders query inspector button', () => {
    renderWithQueryEditorProvider(<QueryOptionsBar />);

    expect(screen.getByRole('button', { name: /query inspector/i })).toBeInTheDocument();
  });

  it('opens query inspector drawer from the dashboard scene', async () => {
    const panel = { getRef: jest.fn().mockReturnValue('panel-ref-1') } as never;
    const showModal = jest.fn();
    getDashboardSceneFor.mockReturnValue({ showModal });

    const { user } = renderWithQueryEditorProvider(<QueryOptionsBar />, {
      panelState: { panel },
      uiStateOverrides: { cardType: QueryEditorType.Query },
    });

    await user.click(screen.getByRole('button', { name: /query inspector/i }));

    expect(getDashboardSceneFor).toHaveBeenCalledWith(panel);
    expect(panelInspectDrawerMock).toHaveBeenCalledWith({ panelRef: 'panel-ref-1', currentTab: InspectTab.Query });
    expect(showModal).toHaveBeenCalledWith({
      kind: 'panel-inspect-drawer',
      args: { panelRef: 'panel-ref-1', currentTab: InspectTab.Query },
    });
    expect(trackQueryMenuAction).toHaveBeenCalledWith('open_inspector', QueryEditorType.Query);
  });

  describe('query options', () => {
    const openSidebar = jest.fn();
    const closeSidebar = jest.fn();

    function renderBar(isQueryOptionsOpen: boolean, ui = <QueryOptionsBar />) {
      return renderWithQueryEditorProvider(ui, {
        uiStateOverrides: {
          queryOptions: { ...mockQueryOptionsState, isQueryOptionsOpen, openSidebar, closeSidebar },
        },
      });
    }

    it('opens the sidebar without a focused field from the "Query options" button', async () => {
      const { user } = renderBar(false);

      await user.click(screen.getByRole('button', { name: 'Query options' }));

      expect(openSidebar).toHaveBeenCalledWith();
      expect(closeSidebar).not.toHaveBeenCalled();
      expect(trackQueryOptionsToggle).toHaveBeenCalledWith(true);
    });

    it('closes the sidebar from the "Query options" button when it is already open', async () => {
      const { user } = renderBar(true);

      await user.click(screen.getByRole('button', { name: 'Query options' }));

      expect(closeSidebar).toHaveBeenCalledTimes(1);
      expect(openSidebar).not.toHaveBeenCalled();
      expect(trackQueryOptionsToggle).toHaveBeenCalledWith(false);
    });

    it('opens the sidebar focused on the clicked option', async () => {
      const { user } = renderBar(false);

      await user.click(screen.getByRole('button', { name: 'Edit Max data points' }));

      expect(openSidebar).toHaveBeenCalledWith(QueryOptionField.maxDataPoints);
      expect(trackQueryOptionsToggle).toHaveBeenCalledWith(true);
    });

    it('opens the sidebar without a focused field from the read-only interval option', async () => {
      const { user } = renderBar(false);

      await user.click(screen.getByRole('button', { name: 'Edit Interval' }));

      expect(openSidebar).toHaveBeenCalledWith();
    });

    it('switches the open sidebar to the clicked option without treating the click as outside', async () => {
      const { user } = renderBar(
        true,
        <>
          <QueryOptionsBar />
          <QueryEditorDetailsSidebar />
        </>
      );

      await user.click(screen.getByRole('button', { name: 'Edit Relative time' }));

      expect(openSidebar).toHaveBeenCalledWith(QueryOptionField.relativeTime);
      expect(closeSidebar).not.toHaveBeenCalled();
    });
  });

  // The fade marks options clipped off the end. A fixed one would leave the last option faded with
  // the list scrolled all the way to it.
  describe('clipped-edge fade', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    /** jsdom has no layout, so give the item list a 300px scroll port over 500px of options. */
    function stubOverflow() {
      jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
      jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500);
    }

    function getItemList() {
      return screen.getByRole('button', { name: /edit max data points/i }).closest('ul')!;
    }

    it('fades the end while options are clipped', () => {
      stubOverflow();
      renderWithQueryEditorProvider(<QueryOptionsBar />);

      expect(getComputedStyle(getItemList()).maskImage).toContain('linear-gradient');
    });

    it('drops the fade once scrolled to the end', () => {
      stubOverflow();
      renderWithQueryEditorProvider(<QueryOptionsBar />);
      const list = getItemList();

      list.scrollLeft = 200;
      fireEvent.scroll(list);

      expect(getComputedStyle(list).maskImage).toBe('');
    });
  });
});
