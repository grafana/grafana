import { screen } from '@testing-library/react';

import { InspectTab } from 'app/features/inspector/types';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';

import { QueryEditorFooter } from './QueryEditorFooter';

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

describe('QueryEditorFooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders query inspector button', () => {
    renderWithQueryEditorProvider(<QueryEditorFooter />);

    expect(screen.getByRole('button', { name: /query inspector/i })).toBeInTheDocument();
  });

  it('opens query inspector drawer from the dashboard scene', async () => {
    const panel = { getRef: jest.fn().mockReturnValue('panel-ref-1') } as never;
    const showModal = jest.fn();
    getDashboardSceneFor.mockReturnValue({ showModal });

    const { user } = renderWithQueryEditorProvider(<QueryEditorFooter />, {
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
});
