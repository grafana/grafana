import { SceneRefreshPicker, SceneTimePicker, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { buildVizPanelState } from 'app/features/dashboard-scene/serialization/layoutSerializers/utils';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { defaultVisualizationPanelKind } from 'app/features/notebook/types';

import { NotebookScene } from '../scene/NotebookScene';
import { NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NotebookLayoutManager } from '../scene/layout-notebook/NotebookLayoutManager';
import { setQueryRunnerQueries } from '../scene/layout-notebook/setQueryRunnerQueries';

import { readNotebookShape } from './shape';

function sceneWithCells(cells: NotebookCellItem[]): NotebookScene {
  const manager = new NotebookLayoutManager({
    cells,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  });

  return new NotebookScene({
    title: 'My notebook',
    body: manager,
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    timePicker: new SceneTimePicker({}),
    refreshPicker: new SceneRefreshPicker({}),
  });
}

function markdownCell(elementName: string, source: 'user' | 'assistant', text = 'hello'): NotebookCellItem {
  return new NotebookCellItem({ elementName, source, content: { kind: 'Markdown', spec: { text } } });
}

function codeCell(elementName: string, source: 'user' | 'assistant'): NotebookCellItem {
  return new NotebookCellItem({
    elementName,
    source,
    content: { kind: 'Code', spec: { language: 'promql', code: 'up' } },
  });
}

function panelCell(elementName: string, source: 'user' | 'assistant', queries?: DataQuery[]): NotebookCellItem {
  const panel = new VizPanel(buildVizPanelState(defaultVisualizationPanelKind(), 1));
  if (queries) {
    setQueryRunnerQueries(getQueryRunnerFor(panel)!, queries);
  }
  return new NotebookCellItem({ elementName, source, body: panel });
}

describe('readNotebookShape', () => {
  it('reads counts and types across a mix of cells', () => {
    const scene = sceneWithCells([
      markdownCell('intro', 'user'),
      codeCell('query', 'user'),
      panelCell('latency', 'user', [{ refId: 'A', datasource: { type: 'prometheus', uid: 'ds1' } }]),
      markdownCell('note', 'assistant'),
    ]);

    expect(readNotebookShape(scene)).toEqual({
      cellCount: 4,
      cellsByType: ['markdown', 'code', 'panel', 'markdown'],
      panelCount: 1,
      datasourceTypes: ['prometheus'],
      assistantCellCount: 1,
      nonEmptyCellCount: 4,
      textCellCount: 2,
      codeCellCount: 1,
      configuredPanelCount: 1,
      datasourceCount: 1,
    });
  });

  it('reports an empty shape for a notebook with only the trailing empty editor block', () => {
    const scene = sceneWithCells([markdownCell('empty-slot', 'user', '')]);

    expect(readNotebookShape(scene)).toEqual({
      cellCount: 0,
      cellsByType: [],
      panelCount: 0,
      datasourceTypes: [],
      assistantCellCount: 0,
      nonEmptyCellCount: 0,
      textCellCount: 0,
      codeCellCount: 0,
      configuredPanelCount: 0,
      datasourceCount: 0,
    });
  });

  it('reports activation counts that treat empty markdown and unconfigured panels as empty', () => {
    const scene = sceneWithCells([markdownCell('empty', 'user', ''), panelCell('unconfigured', 'user')]);

    const shape = readNotebookShape(scene);
    expect(shape.cellCount).toBe(2);
    expect(shape.nonEmptyCellCount).toBe(0);
    expect(shape.configuredPanelCount).toBe(0);
  });

  it('counts a configured panel and non-empty text/code cells', () => {
    const scene = sceneWithCells([
      markdownCell('intro', 'user', 'hello'),
      codeCell('query', 'user'),
      panelCell('latency', 'user', [{ refId: 'A', datasource: { type: 'prometheus', uid: 'ds1' } }]),
    ]);

    const shape = readNotebookShape(scene);
    expect(shape.nonEmptyCellCount).toBe(3);
    expect(shape.textCellCount).toBe(1);
    expect(shape.codeCellCount).toBe(1);
    expect(shape.configuredPanelCount).toBe(1);
    expect(shape.datasourceCount).toBe(1);
  });

  it('deduplicates datasource types across panels on the same datasource', () => {
    const scene = sceneWithCells([
      panelCell('panel-a', 'user', [{ refId: 'A', datasource: { type: 'prometheus', uid: 'ds1' } }]),
      panelCell('panel-b', 'user', [{ refId: 'A', datasource: { type: 'prometheus', uid: 'ds1' } }]),
    ]);

    const shape = readNotebookShape(scene);
    expect(shape.panelCount).toBe(2);
    expect(shape.datasourceTypes).toEqual(['prometheus']);
  });
});
