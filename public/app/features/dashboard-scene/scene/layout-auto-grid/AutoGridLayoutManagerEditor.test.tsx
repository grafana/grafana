import { act, screen } from '@testing-library/react';
import { render, userEvent } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { changeAutoGridMaxHeightMode } from '../../actions/layout/changeAutoGridOption';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';

import { AutoGridLayoutManager } from './AutoGridLayoutManager';
import { getSidebarOptions } from './AutoGridLayoutManagerEditor';

const autoGridSelectors = selectors.components.PanelEditor.ElementEditPane.AutoGridLayout;

async function commitValue(input: HTMLElement, value: string) {
  await userEvent.clear(input);
  await userEvent.type(input, value);
  await userEvent.tab();
}

function setup(manager: AutoGridLayoutManager) {
  const dashboard = new DashboardScene({ isEditing: true, body: manager });
  const deactivate = activateFullSceneTree(dashboard);
  const [columnOptions, rowOptions] = getSidebarOptions(manager);

  render(
    <>
      {columnOptions.props.render(columnOptions)}
      {rowOptions.props.render(rowOptions)}
    </>
  );

  return { sidebar: dashboard.state.sidebar, deactivate };
}

describe('AutoGridLayoutManagerEditor', () => {
  it('records toggling fill screen in undo history', async () => {
    const manager = new AutoGridLayoutManager({ fillScreen: false });
    const { sidebar, deactivate } = setup(manager);

    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen)
    );

    expect(manager.state.fillScreen).toBe(true);
    expect(sidebar.state.undoStack).toHaveLength(1);
    deactivate();
  });

  it('does not record leaving an unchanged custom row height', async () => {
    const manager = new AutoGridLayoutManager({ rowHeight: 300 });
    const { sidebar, deactivate } = setup(manager);

    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight)
    );
    await userEvent.tab();

    expect(sidebar.state.undoStack).toHaveLength(0);
    deactivate();
  });

  it('shows the restored custom row height after undo', async () => {
    const manager = new AutoGridLayoutManager({ rowHeight: 300 });
    const { sidebar, deactivate } = setup(manager);
    const input = screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight);

    await userEvent.clear(input);
    await userEvent.type(input, '400');
    await userEvent.tab();
    expect(manager.state.rowHeight).toBe(400);

    act(() => sidebar.undoAction());

    expect(
      await screen.findByTestId(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight)
    ).toHaveValue(300);
    deactivate();
  });

  it('clears a just typed custom row height with one click', async () => {
    const manager = new AutoGridLayoutManager({ rowHeight: 300 });
    const { deactivate } = setup(manager);
    const input = screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.customRowHeight);

    await userEvent.clear(input);
    await userEvent.type(input, '400');
    await userEvent.click(
      screen.getByTestId(selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.clearCustomRowHeight)
    );

    expect(manager.state.rowHeight).toBe('standard');
    deactivate();
  });

  it.each([
    { name: 'row height', state: { rowHeight: 300 }, inputTestId: autoGridSelectors.customRowHeight },
    { name: 'min column width', state: { columnWidth: 300 }, inputTestId: autoGridSelectors.customMinColumnWidth },
  ])('clears the custom $name error when undo restores a valid value', async ({ state, inputTestId }) => {
    const { sidebar, deactivate } = setup(new AutoGridLayoutManager(state));
    const input = screen.getByTestId(inputTestId);

    await commitValue(input, '400');
    await commitValue(input, '10');
    expect(screen.getByText('A number between 50 and 2000 is required')).toBeInTheDocument();

    act(() => sidebar.undoAction());

    expect(input).toHaveValue(300);
    expect(screen.queryByText('A number between 50 and 2000 is required')).not.toBeInTheDocument();
    deactivate();
  });

  describe('with auto height panels', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.GrafanaDashboardsAutoHeightPanels]: true });
    });

    afterEach(() => {
      act(() => setTestFlags({}));
    });

    it('clears the custom max height error when undo leaves custom mode', async () => {
      const manager = new AutoGridLayoutManager({ fitContent: true, maxHeight: 400 });
      const { sidebar, deactivate } = setup(manager);
      act(() => changeAutoGridMaxHeightMode(manager, 'custom'));

      await commitValue(screen.getByLabelText('Custom max height'), '10');
      expect(screen.getByText('A number between 50 and 10000 is required')).toBeInTheDocument();

      act(() => sidebar.undoAction());

      expect(screen.getByLabelText('Max height')).toHaveValue('Unlimited');
      expect(screen.queryByText('A number between 50 and 10000 is required')).not.toBeInTheDocument();
      deactivate();
    });
  });
});
