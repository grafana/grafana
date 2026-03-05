import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariableHide } from '@grafana/data';
import { ConstantVariable, SceneVariableSet, type SceneVariable } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { SnapshotVariable } from '../../serialization/custom-variables/SnapshotVariable';
import { openAddVariablePane } from '../../settings/variables/VariableAddEditableElement';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import {
  partitionVariablesByDisplay,
  partitionVariablesByEditability,
  DashboardVariablesList,
} from './DashboardVariablesList';

jest.mock('../../settings/variables/VariableAddEditableElement', () => ({
  openAddVariablePane: jest.fn(),
}));

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    addVariableButtonClicked: jest.fn(),
  },
}));

jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: () => [{}, () => {}],
}));
jest.mock('react-use', () => ({
  useLocalStorage: () => [{}, () => {}],
}));

function renderVariablesList(variables: SceneVariable[] = []) {
  const user = userEvent.setup();

  const variableSet = new SceneVariableSet({ variables });
  const dashboardScene = new DashboardScene({
    $variables: variableSet,
    isEditing: true,
  });
  activateFullSceneTree(dashboardScene);
  jest.spyOn(dashboardScene.state.editPane, 'selectObject');

  const renderResult = render(<DashboardVariablesList set={variableSet} />);

  return {
    ...renderResult,
    user,
    elements: {
      dashboardScene,
      aboveListItems: () => renderResult.getAllByTestId('variables-list-visible-variable-name'),
      controlsMenuListItems: () => renderResult.getAllByTestId('variables-list-controls-menu-variable-name'),
      hiddenListItems: () => renderResult.getAllByTestId('variables-list-hidden-variable-name'),
      addVariableButton: () => renderResult.getByRole('button', { name: /add variable/i }),
    },
  };
}

function buildTestVariables() {
  return {
    visibleVar1: new ConstantVariable({ name: 'visibleVar1', hide: VariableHide.dontHide }),
    visibleVar2: new ConstantVariable({ name: 'visibleVar2', hide: VariableHide.hideLabel }),
    controlsMenuVar1: new ConstantVariable({ name: 'controlsMenuVar1', hide: VariableHide.inControlsMenu }),
    hiddenVar1: new ConstantVariable({ name: 'ninjaVar1', hide: VariableHide.hideVariable }),
    snapshotVar1: new SnapshotVariable({ name: 'snapshotVar1' }),
  };
}

describe('<DashboardVariablesList />', () => {
  test('renders 3 sections (one per variable display type) and an "Add variable" button', () => {
    const { visibleVar1, visibleVar2, controlsMenuVar1, hiddenVar1 } = buildTestVariables();
    const { getByRole, elements } = renderVariablesList([hiddenVar1, controlsMenuVar1, visibleVar2, visibleVar1]);

    [/above dashboard/i, /controls menu/i, /hidden/i].forEach((name) => {
      expect(getByRole('heading', { name })).toBeInTheDocument();
    });

    const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
    expect(aboveNames).toEqual(['visibleVar2', 'visibleVar1']); // order is preserved

    const controlsMenuNames = Array.from(elements.controlsMenuListItems()).map((item) => item.textContent);
    expect(controlsMenuNames).toEqual(['controlsMenuVar1']);

    const hiddenNames = Array.from(elements.hiddenListItems()).map((item) => item.textContent);
    expect(hiddenNames).toEqual(['ninjaVar1']);

    expect(elements.addVariableButton()).toBeInTheDocument();
  });

  test('always renders all 3 section titles even when some are empty', () => {
    const { hiddenVar1 } = buildTestVariables();
    const { getByRole } = renderVariablesList([hiddenVar1]);

    [/above dashboard/i, /controls menu/i, /hidden/i].forEach((name) => {
      expect(getByRole('heading', { name })).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    describe('when a variable name is clicked', () => {
      test('selects the variable in the pane', async () => {
        const { visibleVar1 } = buildTestVariables();
        const { user, getByText, elements } = renderVariablesList([visibleVar1]);

        await user.click(getByText(visibleVar1.state.name));

        expect(elements.dashboardScene.state.editPane.selectObject).toHaveBeenCalledWith(
          visibleVar1,
          visibleVar1.state.key
        );
      });
    });

    describe('when the "Add variable" button is clicked', () => {
      test('opens the add variable pane', async () => {
        const { user, elements } = renderVariablesList([]);

        await user.click(elements.addVariableButton());

        expect(openAddVariablePane).toHaveBeenCalledWith(elements.dashboardScene);
      });

      test('calls DashboardInteractions.addVariableButtonClicked ', async () => {
        const { user, elements } = renderVariablesList([]);

        await user.click(elements.addVariableButton());

        expect(DashboardInteractions.addVariableButtonClicked).toHaveBeenCalledWith({ source: 'edit_pane' });
      });
    });

    describe('drag and drop', () => {
      async function dragItem(
        container: HTMLElement,
        findByText: (text: RegExp) => Promise<HTMLElement>,
        itemIndex: number,
        direction: 'up' | 'down',
        positions = 1
      ) {
        const dragHandles = container.querySelectorAll('[data-rfd-drag-handle-draggable-id]');
        const handle = dragHandles[itemIndex] as HTMLElement;
        handle.focus();
        expect(handle).toHaveFocus();

        // press space to start dragging
        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have lifted an item/i); // @hello-pangea/dnd announces each phase via aria-live; awaiting it ensures the library has processed the event

        // press arrow down/up to drag
        const arrowKey = direction === 'down' ? 40 : 38;
        for (let i = 0; i < positions; i++) {
          fireEvent.keyDown(handle, { keyCode: arrowKey });
          await findByText(/you have moved the item/i);
        }

        // press space to drop
        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have dropped the item/i);
      }

      test('reorders visible variables when dragged down by one position', async () => {
        const { visibleVar1, visibleVar2, controlsMenuVar1 } = buildTestVariables();
        const { container, findByText, elements } = renderVariablesList([visibleVar1, visibleVar2, controlsMenuVar1]);

        await dragItem(container, findByText, 0, 'down');

        const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
        expect(aboveNames).toEqual(['visibleVar2', 'visibleVar1']);
      });
    });
  });
});

describe('partitionVariablesByDisplay()', () => {
  test('separates variables into 3 lists: visible, controlsMenu and hidden, while preserving order', () => {
    const { visibleVar1, visibleVar2, controlsMenuVar1, hiddenVar1 } = buildTestVariables();

    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay([
      hiddenVar1,
      controlsMenuVar1,
      visibleVar2,
      visibleVar1,
    ]);

    expect(visible.length).toBe(2);
    expect(visible[0]).toBe(visibleVar2);
    expect(visible[1]).toBe(visibleVar1);

    expect(controlsMenu.length).toBe(1);
    expect(controlsMenu[0]).toBe(controlsMenuVar1);

    expect(hidden.length).toBe(1);
    expect(hidden[0]).toBe(hiddenVar1);
  });

  test('returns empty lists when given no variables', () => {
    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay([]);

    expect(visible).toEqual([]);
    expect(controlsMenu).toEqual([]);
    expect(hidden).toEqual([]);
  });

  test('excludes non-editable variable types', () => {
    const { visibleVar1: editableVar, snapshotVar1: nonEditableVar } = buildTestVariables();

    const { visible, controlsMenu, hidden } = partitionVariablesByDisplay([nonEditableVar, editableVar]);

    expect(visible.length).toBe(1);
    expect(visible[0]).toBe(editableVar);
    expect(controlsMenu).toEqual([]);
    expect(hidden).toEqual([]);
  });
});

describe('partitionVariablesByEditability()', () => {
  test('separates editable from non-editable variables, while preserving order', () => {
    const { visibleVar1, visibleVar2, snapshotVar1 } = buildTestVariables();

    const { editable, nonEditable } = partitionVariablesByEditability([snapshotVar1, visibleVar2, visibleVar1]);

    expect(editable.length).toBe(2);
    expect(editable[0]).toBe(visibleVar2);
    expect(editable[1]).toBe(visibleVar1);

    expect(nonEditable.length).toBe(1);
    expect(nonEditable[0]).toBe(snapshotVar1);
  });

  test('returns empty lists when given no variables', () => {
    const { editable, nonEditable } = partitionVariablesByEditability([]);

    expect(editable).toEqual([]);
    expect(nonEditable).toEqual([]);
  });

  test('returns all variables as editable when none are non-editable', () => {
    const { visibleVar1, controlsMenuVar1 } = buildTestVariables();

    const { editable, nonEditable } = partitionVariablesByEditability([visibleVar1, controlsMenuVar1]);

    expect(editable[0]).toBe(visibleVar1);
    expect(editable[1]).toBe(controlsMenuVar1);
    expect(nonEditable).toEqual([]);
  });

  test('returns all variables as non-editable when none are editable', () => {
    const { snapshotVar1 } = buildTestVariables();

    const { editable, nonEditable } = partitionVariablesByEditability([snapshotVar1]);

    expect(editable).toEqual([]);
    expect(nonEditable[0]).toBe(snapshotVar1);
  });
});
