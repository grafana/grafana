import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariableHide } from '@grafana/data';
import { AdHocFiltersVariable, ConstantVariable, SceneVariableSet, type SceneVariable } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { activateFullSceneTree } from '../../utils/test-utils';

import { DashboardFiltersList } from './DashboardFiltersList';

jest.mock('../add-new/AddFilters', () => ({
  openAddFilterPane: jest.fn(),
}));

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    addFilterButtonClicked: jest.fn(),
  },
}));

jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: () => [{}, () => {}],
}));
jest.mock('react-use', () => ({
  useLocalStorage: () => [{}, () => {}],
}));

function renderFiltersList(variables: SceneVariable[] = []) {
  const user = userEvent.setup();

  const variableSet = new SceneVariableSet({ variables });
  const dashboardScene = new DashboardScene({
    $variables: variableSet,
    isEditing: true,
  });
  activateFullSceneTree(dashboardScene);
  jest.spyOn(dashboardScene.state.editPane, 'selectObject');

  const renderResult = render(<DashboardFiltersList variableSet={variableSet} />);

  return {
    ...renderResult,
    user,
    elements: {
      dashboardScene,
      aboveListItems: () => within(renderResult.getByTestId('filters-list-visible')).getAllByTestId('filter-name'),
      controlsMenuListItems: () =>
        within(renderResult.getByTestId('filters-list-controls-menu')).getAllByTestId('filter-name'),
      hiddenListItems: () => within(renderResult.getByTestId('filters-list-hidden')).getAllByTestId('filter-name'),
    },
  };
}

function buildTestFilters() {
  return {
    visibleFilter1: new AdHocFiltersVariable({ name: 'visibleFilter1', type: 'adhoc', hide: VariableHide.dontHide }),
    visibleFilter2: new AdHocFiltersVariable({ name: 'visibleFilter2', type: 'adhoc', hide: VariableHide.hideLabel }),
    controlsMenuFilter1: new AdHocFiltersVariable({
      name: 'controlsMenuFilter1',
      type: 'adhoc',
      hide: VariableHide.inControlsMenu,
    }),
    hiddenFilter1: new AdHocFiltersVariable({
      name: 'hiddenFilter1',
      type: 'adhoc',
      hide: VariableHide.hideVariable,
    }),
  };
}

describe('<DashboardFiltersList />', () => {
  test('renders 3 sections (one per filter display type)', () => {
    const { visibleFilter1, visibleFilter2, controlsMenuFilter1, hiddenFilter1 } = buildTestFilters();
    const { getByRole, elements } = renderFiltersList([
      hiddenFilter1,
      controlsMenuFilter1,
      visibleFilter2,
      visibleFilter1,
    ]);

    [/above dashboard/i, /controls menu/i, /hidden/i].forEach((name) => {
      expect(getByRole('heading', { name })).toBeInTheDocument();
    });

    const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
    expect(aboveNames).toEqual(['visibleFilter2', 'visibleFilter1']);

    const controlsMenuNames = Array.from(elements.controlsMenuListItems()).map((item) => item.textContent);
    expect(controlsMenuNames).toEqual(['controlsMenuFilter1']);

    const hiddenNames = Array.from(elements.hiddenListItems()).map((item) => item.textContent);
    expect(hiddenNames).toEqual(['hiddenFilter1']);
  });

  describe('User interactions', () => {
    describe('when a filter name is clicked', () => {
      test('selects the filter in the pane', async () => {
        const { visibleFilter1 } = buildTestFilters();
        const { user, getByText, elements } = renderFiltersList([visibleFilter1]);

        await user.click(getByText(visibleFilter1.state.name));

        expect(elements.dashboardScene.state.editPane.selectObject).toHaveBeenCalledWith(visibleFilter1);
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

        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have lifted an item/i);

        const arrowKey = direction === 'down' ? 40 : 38;
        for (let i = 0; i < positions; i++) {
          fireEvent.keyDown(handle, { keyCode: arrowKey });
          await findByText(/you have moved the item/i);
        }

        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have dropped the item/i);
      }

      test('reorders visible filters when dragged down by one position', async () => {
        const { visibleFilter1, visibleFilter2, controlsMenuFilter1 } = buildTestFilters();
        const { container, findByText, elements } = renderFiltersList([
          visibleFilter1,
          visibleFilter2,
          controlsMenuFilter1,
        ]);

        await dragItem(container, findByText, 0, 'down');

        const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
        expect(aboveNames).toEqual(['visibleFilter2', 'visibleFilter1']);
      });

      test('drag-reorder does not move non-filter variables from their original positions', async () => {
        const { visibleFilter1, visibleFilter2 } = buildTestFilters();
        const nonFilterVar = new ConstantVariable({ name: 'queryVar', hide: VariableHide.dontHide });
        const variableSet = new SceneVariableSet({
          variables: [visibleFilter1, nonFilterVar, visibleFilter2],
        });
        const dashboardScene = new DashboardScene({ $variables: variableSet, isEditing: true });
        activateFullSceneTree(dashboardScene);

        const { container, findByText } = render(<DashboardFiltersList variableSet={variableSet} />);

        const dragHandles = container.querySelectorAll('[data-rfd-drag-handle-draggable-id]');
        const handle = dragHandles[0] as HTMLElement;
        handle.focus();
        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have lifted an item/i);
        fireEvent.keyDown(handle, { keyCode: 40 });
        await findByText(/you have moved the item/i);
        fireEvent.keyDown(handle, { keyCode: 32 });
        await findByText(/you have dropped the item/i);

        const names = variableSet.state.variables.map((v) => v.state.name);
        expect(names).toEqual(['visibleFilter2', 'queryVar', 'visibleFilter1']);
      });
    });
  });
});
