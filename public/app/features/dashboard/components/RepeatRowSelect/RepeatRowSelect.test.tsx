import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { userEvent } from 'test/test-utils';

import {
  CustomVariable,
  type SceneObject,
  type SceneVariable,
  SceneGridLayout,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardGridItem } from 'app/features/dashboard-scene/scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from 'app/features/dashboard-scene/scene/layout-rows/RowItem';
import { RowsLayoutManager } from 'app/features/dashboard-scene/scene/layout-rows/RowsLayoutManager';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { RepeatRowSelect2 } from './RepeatRowSelect';

async function buildTestScene(variables?: SceneVariable[]) {
  const dashboard = new DashboardScene({
    uid: 'A',
    $variables: new SceneVariableSet({
      variables: variables ?? [],
    }),
  });

  activateFullSceneTree(dashboard);
  await new Promise((r) => setTimeout(r, 1));
  return dashboard;
}

const RepeatRowSelectWrapper = ({ sceneContext }: { sceneContext: SceneObject }) => {
  const [repeat, setRepeat] = useState<string | undefined>(undefined);
  return (
    <RepeatRowSelect2 sceneContext={sceneContext} repeat={repeat} onChange={(newRepeat) => setRepeat(newRepeat)} />
  );
};

const setup = async (variables?: SceneVariable[]) => {
  const scene = await buildTestScene(variables);

  return render(<RepeatRowSelectWrapper sceneContext={scene} />);
};

describe('RepeatRowSelect2', () => {
  beforeAll(() => {
    const mockGetBoundingClientRect = jest.fn(() => ({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    }));

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
    });
  });

  it('should render correct options', async () => {
    const variableA = new CustomVariable({
      name: 'testVar',
      query: 'test, test2',
      value: 'test',
      text: 'testVar',
    });
    const variableB = new CustomVariable({
      name: 'otherVar',
      query: 'test, test2',
      value: 'test',
      text: 'otherVar',
    });

    await setup([variableA, variableB]);

    const input = screen.getByRole('combobox');

    expect(input).not.toBeDisabled();
    expect(input).toHaveProperty('placeholder', 'Choose');
    await userEvent.click(input);

    expect(await screen.findByText(/Disable repeating/)).toBeInTheDocument();
    expect(screen.getByText(/testVar/)).toBeInTheDocument();
    expect(screen.getByText(/otherVar/)).toBeInTheDocument();
  });

  it('should be disabled when there are no template variables', async () => {
    await setup();

    expect(screen.getByRole('combobox')).toHaveProperty('placeholder', 'No template variables found');
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('includes section variables when sceneContext is under a RowItem with section SceneVariableSet', async () => {
    const dashVar = new CustomVariable({
      name: 'dashVar',
      query: 'a',
      value: 'a',
      text: 'a',
    });
    const sectionVar = new CustomVariable({
      name: 'sectionVar',
      query: 'b',
      value: 'b',
      text: 'b',
    });

    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const gridItem = new DashboardGridItem({ body: panel });
    const row = new RowItem({
      title: 'Row 1',
      $variables: new SceneVariableSet({ variables: [sectionVar] }),
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [gridItem] }),
      }),
    });
    new DashboardScene({
      uid: 'section-repeat-test',
      $variables: new SceneVariableSet({ variables: [dashVar] }),
      body: new RowsLayoutManager({ rows: [row] }),
    });

    await new Promise((r) => setTimeout(r, 1));

    render(<RepeatRowSelectWrapper sceneContext={gridItem} />);

    const input = screen.getByRole('combobox');
    expect(input).not.toBeDisabled();
    await userEvent.click(input);

    expect(await screen.findByText(/sectionVar/)).toBeInTheDocument();
    expect(screen.getByText(/dashVar/)).toBeInTheDocument();
  });

  it('excludes the row own section variables for row repeat options (walk starts at parent)', async () => {
    const dashVar = new CustomVariable({
      name: 'dashVar',
      query: 'a',
      value: 'a',
      text: 'a',
    });
    const sectionVar = new CustomVariable({
      name: 'sectionVar',
      query: 'b',
      value: 'b',
      text: 'b',
    });

    const panel = new VizPanel({ key: 'panel-2', pluginId: 'text' });
    const gridItem = new DashboardGridItem({ body: panel });
    const row = new RowItem({
      title: 'Row 1',
      $variables: new SceneVariableSet({ variables: [sectionVar] }),
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [gridItem] }),
      }),
    });
    new DashboardScene({
      uid: 'row-repeat-exclude-own',
      $variables: new SceneVariableSet({ variables: [dashVar] }),
      body: new RowsLayoutManager({ rows: [row] }),
    });

    await new Promise((r) => setTimeout(r, 1));

    render(<RepeatRowSelectWrapper sceneContext={row} />);

    const input = screen.getByRole('combobox');
    expect(input).not.toBeDisabled();
    await userEvent.click(input);

    expect(await screen.findByText(/dashVar/)).toBeInTheDocument();
    expect(screen.queryByText(/^sectionVar$/)).not.toBeInTheDocument();
  });
});
