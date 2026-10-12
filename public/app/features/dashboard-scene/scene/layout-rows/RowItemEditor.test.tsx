import { act, render, screen, userEvent } from 'test/test-utils';

import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { RowItem, type RowItemState } from './RowItem';
import { FillScreenSwitch, RowHeaderSwitch, RowRepeatSelect } from './RowItemEditor';
import { RowsLayoutManager } from './RowsLayoutManager';

function buildRow(rowState: Partial<RowItemState> = {}) {
  const row = new RowItem({ title: 'Row 1', layout: DefaultGridLayoutManager.createEmpty(), ...rowState });
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [new CustomVariable({ name: 'server', query: 'A,B', value: 'A', text: 'A' })],
    }),
    isEditing: true,
    body: new RowsLayoutManager({ rows: [row] }),
  });
  activateFullSceneTree(dashboard);

  return { row, sidebar: dashboard.state.sidebar };
}

describe('RowItemEditor', () => {
  describe('RowHeaderSwitch', () => {
    it('records hiding the header as an undoable action and restores it on undo/redo', async () => {
      const { row, sidebar } = buildRow({ hideHeader: false });
      render(<RowHeaderSwitch row={row} />);

      await userEvent.click(screen.getByRole('switch'));

      expect(row.state.hideHeader).toBe(true);
      expect(screen.getByRole('switch')).toBeChecked();
      expect(sidebar.state.undoStack).toHaveLength(1);
      expect(sidebar.state.undoStack[0].description).toBe('Hide row header');

      act(() => sidebar.undoAction());

      expect(row.state.hideHeader).toBe(false);
      expect(screen.getByRole('switch')).not.toBeChecked();
      expect(sidebar.state.undoStack).toHaveLength(0);
      expect(sidebar.state.redoStack).toHaveLength(1);

      act(() => sidebar.redoAction());

      expect(row.state.hideHeader).toBe(true);
      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('records showing a hidden header with its own description and restores the hidden state on undo', async () => {
      const { row, sidebar } = buildRow({ hideHeader: true });
      render(<RowHeaderSwitch row={row} />);

      await userEvent.click(screen.getByRole('switch'));

      expect(row.state.hideHeader).toBe(false);
      expect(sidebar.state.undoStack[0].description).toBe('Show row header');

      act(() => sidebar.undoAction());

      expect(row.state.hideHeader).toBe(true);
    });
  });

  describe('FillScreenSwitch', () => {
    it('records enabling fill screen as an undoable action and restores it on undo/redo', async () => {
      const { row, sidebar } = buildRow({ fillScreen: false });
      render(<FillScreenSwitch row={row} />);

      await userEvent.click(screen.getByRole('switch'));

      expect(row.state.fillScreen).toBe(true);
      expect(screen.getByRole('switch')).toBeChecked();
      expect(sidebar.state.undoStack).toHaveLength(1);
      expect(sidebar.state.undoStack[0].description).toBe('Enable row fill screen');

      act(() => sidebar.undoAction());

      expect(row.state.fillScreen).toBe(false);
      expect(screen.getByRole('switch')).not.toBeChecked();
      expect(sidebar.state.undoStack).toHaveLength(0);
      expect(sidebar.state.redoStack).toHaveLength(1);

      act(() => sidebar.redoAction());

      expect(row.state.fillScreen).toBe(true);
      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('records disabling fill screen with its own description and restores the enabled state on undo', async () => {
      const { row, sidebar } = buildRow({ fillScreen: true });
      render(<FillScreenSwitch row={row} />);

      await userEvent.click(screen.getByRole('switch'));

      expect(row.state.fillScreen).toBe(false);
      expect(sidebar.state.undoStack[0].description).toBe('Disable row fill screen');

      act(() => sidebar.undoAction());

      expect(row.state.fillScreen).toBe(true);
    });
  });

  describe('RowRepeatSelect', () => {
    beforeAll(() => {
      mockComboboxRect();
    });

    it('records selecting a repeat variable as an undoable action and restores it on undo/redo', async () => {
      const { row, sidebar } = buildRow();
      render(<RowRepeatSelect row={row} />);

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', { name: 'server' }));

      expect(row.state.repeatByVariable).toBe('server');
      expect(sidebar.state.undoStack).toHaveLength(1);
      expect(sidebar.state.undoStack[0].description).toBe('Row repeat by');

      act(() => sidebar.undoAction());

      expect(row.state.repeatByVariable).toBeUndefined();
      expect(sidebar.state.undoStack).toHaveLength(0);
      expect(sidebar.state.redoStack).toHaveLength(1);

      act(() => sidebar.redoAction());

      expect(row.state.repeatByVariable).toBe('server');
    });

    it('records disabling repeating as an undoable action and restores the variable on undo', async () => {
      const { row, sidebar } = buildRow({ repeatByVariable: 'server' });
      render(<RowRepeatSelect row={row} />);

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', { name: 'Disable repeating' }));

      expect(row.state.repeatByVariable).toBeUndefined();
      expect(sidebar.state.undoStack).toHaveLength(1);
      expect(sidebar.state.undoStack[0].description).toBe('Row repeat by');

      act(() => sidebar.undoAction());

      expect(row.state.repeatByVariable).toBe('server');
    });

    it('does not record an action when the already selected variable is picked again', async () => {
      const { row, sidebar } = buildRow({ repeatByVariable: 'server' });
      render(<RowRepeatSelect row={row} />);

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', { name: 'server' }));

      expect(row.state.repeatByVariable).toBe('server');
      expect(sidebar.state.undoStack).toHaveLength(0);
    });
  });
});
