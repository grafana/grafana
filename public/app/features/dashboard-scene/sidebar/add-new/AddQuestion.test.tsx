import { act, waitFor } from '@testing-library/react';
import { type JSX } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { usePluginComponents } from '@grafana/runtime';
import { type SceneObject } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { QuestionEdit } from '../questions/QuestionEdit';

import { AddQuestion } from './AddQuestion';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponents: jest.fn(),
}));

const PluginControl = createComponentWithMeta<JSX.IntrinsicAttributes>(
  { pluginId: 'grafana-assistant-app', title: 'Ask Assistant', component: () => null },
  'grafana/dashboard/controls/v1'
);

describe('AddQuestion', () => {
  beforeEach(() => {
    jest.mocked(usePluginComponents).mockReturnValue({ components: [PluginControl], isLoading: false });
    setTestFlags({ 'grafana.dashboardQuestions': true });
  });

  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it.each([false, true])(
    'adds a question to the dashboard and opens it, with explicit opening %s',
    async (sidebarExplicitOpen) => {
      setTestFlags({ 'grafana.dashboardQuestions': true, 'grafana.dashboardSidebarExplicitOpen': sidebarExplicitOpen });
      const { dashboard } = renderAddQuestion();

      await userEvent.click(screen.getByRole('button', { name: 'Question' }));

      await waitFor(() => {
        expect(dashboard.state.questions).toEqual([{ text: '' }]);
      });
      const selected = dashboard.state.sidebar.getSelectedObject();
      expect(selected instanceof QuestionEdit && selected.state.ownerKind).toBe('dashboard');
      expect(dashboard.state.sidebar.state.openPane?.getId()).toBe('element');
    }
  );

  it('adds a question to the row the selection is in', async () => {
    const { dashboard, row } = renderAddQuestion((row) => row);

    await userEvent.click(screen.getByRole('button', { name: 'Question' }));

    await waitFor(() => {
      expect(row.state.questions).toEqual([{ text: '' }]);
    });
    expect(dashboard.state.questions).toBeUndefined();
    const selected = dashboard.state.sidebar.getSelectedObject();
    expect(selected instanceof QuestionEdit && selected.state.ownerKind).toBe('row');
  });

  it('adds a question to the row of the question being edited', async () => {
    const { dashboard, row } = renderAddQuestion(
      (row) => new QuestionEdit({ ownerRef: row.getRef(), ownerKind: 'row', questionIndex: 0 }),
      [{ text: 'Why did errors rise?' }]
    );

    await userEvent.click(screen.getByRole('button', { name: 'Question' }));

    await waitFor(() => {
      expect(row.state.questions).toEqual([{ text: 'Why did errors rise?' }, { text: '' }]);
    });
    expect(dashboard.state.questions).toBeUndefined();
    const selected = dashboard.state.sidebar.getSelectedObject();
    expect(selected instanceof QuestionEdit && selected.state.questionIndex).toBe(1);
  });

  it.each<[string, boolean, 'v1' | 'v2']>([
    ['grafana.dashboardQuestions is off', false, 'v2'],
    // A v1 save drops the questions.
    ['the dashboard saves as v1', true, 'v1'],
  ])('offers no questions while %s', (_, questionsEnabled, serializerVersion) => {
    setTestFlags({ 'grafana.dashboardQuestions': questionsEnabled });
    renderAddQuestion(undefined, undefined, serializerVersion);

    expect(screen.queryByRole('button', { name: 'Question' })).not.toBeInTheDocument();
  });
});

/** Renders the button for a dashboard with one row, `getSelected` picking what is selected from the row. */
function renderAddQuestion(
  getSelected?: (row: RowItem) => SceneObject,
  rowQuestions?: Array<{ text: string }>,
  serializerVersion: 'v1' | 'v2' = 'v2'
) {
  const row = new RowItem({
    title: 'Errors',
    layout: DefaultGridLayoutManager.createEmpty(),
    questions: rowQuestions,
  });
  const dashboard = new DashboardScene(
    { title: 'Checkout', isEditing: true, body: new RowsLayoutManager({ rows: [row] }) },
    serializerVersion
  );
  // The sidebar opens panes only while active, as it is while the dashboard is edited.
  act(() => {
    dashboard.state.sidebar.activate();
  });
  render(<AddQuestion dashboardScene={dashboard} selectedElement={getSelected?.(row)} />);
  return { dashboard, row };
}
