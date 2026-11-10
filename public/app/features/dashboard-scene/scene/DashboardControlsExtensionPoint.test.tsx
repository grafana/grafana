import { act } from '@testing-library/react';
import { type JSX } from 'react';
import { render, screen } from 'test/test-utils';

import { type PluginExtensionDashboardControlsContext, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { DashboardControlsExtensionPoint } from './DashboardControlsExtensionPoint';
import { DashboardScene } from './DashboardScene';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

type ControlProps = PluginExtensionDashboardControlsContext & JSX.IntrinsicAttributes;

const PluginControl = createComponentWithMeta<ControlProps>(
  {
    pluginId: 'grafana-assistant-app',
    title: 'Ask Assistant',
    component: ({ suggestedQuestions }) => <div>{suggestedQuestions.map((question) => question.text).join(', ')}</div>,
  },
  PluginExtensionPoints.DashboardControls
);

describe('DashboardControlsExtensionPoint', () => {
  beforeEach(() => {
    jest.mocked(usePluginComponents<ControlProps>).mockReturnValue({ components: [PluginControl], isLoading: false });
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('gives plugin controls the questions saved on the dashboard', () => {
    setTestFlags({ 'grafana.dashboardSuggestedQuestions': true });
    renderControls();

    expect(screen.getByText('What stands out?')).toBeInTheDocument();
  });

  it('renders no plugin controls while grafana.dashboardSuggestedQuestions is off', () => {
    setTestFlags({ 'grafana.dashboardSuggestedQuestions': false });
    renderControls();

    expect(screen.queryByText('What stands out?')).not.toBeInTheDocument();
  });
});

function renderControls() {
  const dashboard = new DashboardScene({ suggestedQuestions: [{ text: 'What stands out?' }] });
  return render(<DashboardControlsExtensionPoint owner={dashboard} />);
}
