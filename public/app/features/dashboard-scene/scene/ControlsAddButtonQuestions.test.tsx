import { act, waitFor } from '@testing-library/react';
import { type JSX } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { usePluginComponents } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { QuestionEdit } from '../sidebar/questions/QuestionEdit';

import { AddControlsButton } from './ControlsAddButton';
import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

const PluginControl = createComponentWithMeta<JSX.IntrinsicAttributes>(
  { pluginId: 'grafana-assistant-app', title: 'Ask Assistant', component: () => null },
  'grafana/dashboard/controls/v1'
);

describe('AddControlsButton', () => {
  beforeEach(() => {
    jest.mocked(usePluginComponents).mockReturnValue({ components: [PluginControl], isLoading: false });
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('adds a question to the dashboard and opens it', async () => {
    setTestFlags({ 'grafana.dashboardQuestions': true });
    const dashboard = renderAddButton('v2');

    await userEvent.click(screen.getByTestId(selectors.components.ControlsAddButton.triggerButton));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Question' }));

    await waitFor(() => {
      expect(dashboard.state.questions).toEqual([{ text: '' }]);
    });
    const selected = dashboard.state.sidebar.getSelectedObject();
    expect(selected instanceof QuestionEdit && selected.state.questionIndex).toBe(0);
  });

  it.each<[string, boolean, 'v1' | 'v2']>([
    ['grafana.dashboardQuestions is off', false, 'v2'],
    // A v1 save drops the questions.
    ['the dashboard saves as v1', true, 'v1'],
  ])('offers no questions while %s', async (_, questionsEnabled, serializerVersion) => {
    setTestFlags({ 'grafana.dashboardQuestions': questionsEnabled });
    renderAddButton(serializerVersion);

    await userEvent.click(screen.getByTestId(selectors.components.ControlsAddButton.triggerButton));

    expect(await screen.findByRole('menuitem', { name: 'Link' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Question' })).not.toBeInTheDocument();
  });
});

function renderAddButton(serializerVersion: 'v1' | 'v2') {
  const dashboard = new DashboardScene(
    { title: 'Checkout', isEditing: true, body: DefaultGridLayoutManager.createEmpty() },
    serializerVersion
  );
  // The sidebar opens panes only while active, as it is while the dashboard is edited.
  act(() => {
    dashboard.state.sidebar.activate();
  });
  render(<AddControlsButton dashboard={dashboard} />);
  return dashboard;
}
