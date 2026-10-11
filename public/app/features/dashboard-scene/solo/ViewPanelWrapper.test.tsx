
import { render } from '@testing-library/react';

import { useFlagGrafanaViewPanelPane } from '@grafana/runtime/internal';
import { useSceneObjectState, type VizPanel } from '@grafana/scenes';

import { getDashboardSceneLike } from '../scene/types/dashboard';

import { ViewPanelWrapper } from './ViewPanelWrapper';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagGrafanaViewPanelPane: jest.fn(),
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  useSceneObjectState: jest.fn(),
}));

jest.mock('../scene/types/dashboard', () => ({
  ...jest.requireActual('../scene/types/dashboard'),
  getDashboardSceneLike: jest.fn(),
}));

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => true,
}));

describe('ViewPanelWrapper', () => {
  it('does not automatically open the view panel pane on mount', () => {
    const sidebar = {
      state: { openPane: undefined },
      openPane: jest.fn(),
      closePane: jest.fn(),
      subscribeToEvent: jest.fn(() => ({ unsubscribe: jest.fn() })),
    };

    const dashboard = {
      useState: () => ({ sidebar }),
    };

    const dataProvider = {
      useState: () => ({ data: { series: [] } }),
    };

    const panel = {
      state: { key: 'panel-1' },
      getRef: jest.fn(() => ({})),
      setState: jest.fn(),
      Component: () => <div>Panel content</div>,
    } as unknown as VizPanel;

    (useFlagGrafanaViewPanelPane as jest.Mock).mockReturnValue(true);
    (getDashboardSceneLike as jest.Mock).mockReturnValue(dashboard);
    (useSceneObjectState as jest.Mock).mockImplementation((sceneObject: unknown) =>
      sceneObject === panel ? { $data: dataProvider } : { fanoutMode: undefined }
    );

    render(<ViewPanelWrapper panel={panel} showControlsPane />);

    expect(sidebar.openPane).not.toHaveBeenCalled();
  });
});
