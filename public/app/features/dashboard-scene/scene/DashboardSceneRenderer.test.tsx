import { render } from '@testing-library/react';

import { KioskMode } from 'app/types/dashboard';

import { DashboardScene } from './DashboardScene';
import { DashboardSceneRenderer } from './DashboardSceneRenderer';

jest.mock('react-router-dom-v5-compat', () => ({
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
}));

jest.mock('app/types/store', () => ({
  useSelector: jest.fn().mockReturnValue({}),
}));

jest.mock('app/core/selectors/navModel', () => ({
  getNavModel: jest.fn().mockReturnValue({}),
}));

jest.mock('app/core/components/Page/Page', () => ({
  Page: ({ children }: any) => children,
}));

jest.mock('../edit-pane/DashboardEditPaneSplitter', () => ({
  DashboardEditPaneSplitter: ({ body }: any) => body,
}));

jest.mock('./DashboardScene', () => ({
  DashboardScene: jest.fn(),
}));

jest.mock('./PanelSearchLayout', () => ({
  PanelSearchLayout: () => null,
}));

jest.mock('./SoloPanelContext', () => ({
  SoloPanelContextProvider: ({ children }: any) => children,
  useDefineSoloPanelContext: () => null,
}));

const STYLE_ID = 'kiosk-embed-panel-menu-hide';

function buildMockModel(kioskMode?: KioskMode) {
  return {
    useState: () => ({
      kioskMode,
      controls: undefined,
      overlay: undefined,
      editview: undefined,
      body: undefined,
      editPanel: undefined,
      viewPanel: undefined,
      panelSearch: {} as any,
      panelsPerRow: undefined,
      isEditing: false,
      layoutOrchestrator: undefined,
    }),
    getPageNav: jest.fn().mockReturnValue(undefined),
    rememberScrollPos: jest.fn(),
    restoreScrollPos: jest.fn(),
  };
}

describe('DashboardSceneRenderer', () => {
  describe('embed kiosk mode CSS injection', () => {
    afterEach(() => {
      document.getElementById(STYLE_ID)?.remove();
    });

    it('should inject hide-panel-menu style when kioskMode is Embed', () => {
      render(<DashboardSceneRenderer model={buildMockModel(KioskMode.Embed) as unknown as DashboardScene} />);
      expect(document.getElementById(STYLE_ID)).toBeInTheDocument();
    });

    it('should NOT inject hide-panel-menu style when kioskMode is Full', () => {
      render(<DashboardSceneRenderer model={buildMockModel(KioskMode.Full) as unknown as DashboardScene} />);
      expect(document.getElementById(STYLE_ID)).not.toBeInTheDocument();
    });

    it('should NOT inject hide-panel-menu style when no kiosk mode is set', () => {
      render(<DashboardSceneRenderer model={buildMockModel(undefined) as unknown as DashboardScene} />);
      expect(document.getElementById(STYLE_ID)).not.toBeInTheDocument();
    });
  });
});
