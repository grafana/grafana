import { act, fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet, NEW_ANNOTATION_COLOR, NEW_ANNOTATION_NAME } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { annotationEditActions } from '../../settings/annotations/actions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { DashboardAnnotationsList, partitionAnnotationsByDisplay } from './DashboardAnnotationsList';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn(),
    getInstanceSettings: jest.fn(),
    reload: jest.fn(),
  })),
}));
jest.mock('../../settings/annotations/actions', () => ({
  annotationEditActions: { addAnnotation: jest.fn() },
}));

jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: () => [{}, () => {}],
}));
jest.mock('react-use', () => ({
  useLocalStorage: () => [{}, () => {}],
}));

async function renderAnnotationsList(annotationLayers: DashboardAnnotationsDataLayer[] = []) {
  const user = userEvent.setup();

  const dataLayerSet = new DashboardDataLayerSet({ annotationLayers });
  const dashboardScene = new DashboardScene({ $data: dataLayerSet });

  activateFullSceneTree(dashboardScene);
  jest.spyOn(dashboardScene.state.editPane, 'selectObject');

  let renderResult!: ReturnType<typeof render>;

  await act(async () => {
    renderResult = render(<DashboardAnnotationsList dataLayerSet={dataLayerSet} />);
  });

  return {
    ...renderResult,
    user,
    elements: {
      dashboardScene,
      dataLayerSet,
      aboveListItems: () =>
        within(renderResult.getByTestId('annotations-list-visible')).getAllByTestId('annotation-name'),
      controlsMenuListItems: () =>
        within(renderResult.getByTestId('annotations-list-controls-menu')).getAllByTestId('annotation-name'),
      hiddenListItems: () =>
        within(renderResult.getByTestId('annotations-list-hidden')).getAllByTestId('annotation-name'),
      addAnnotationButton: () => renderResult.getByRole('button', { name: /add annotation query/i }),
    },
  };
}

function buildTestAnnotations() {
  return {
    visibleEnabled: new DashboardAnnotationsDataLayer({
      name: 'annotation-visible-enabled',
      isHidden: false,
      isEnabled: true,
      query: {
        enable: true,
        name: '',
        iconColor: '',
      },
    }),
    visibleDisabled: new DashboardAnnotationsDataLayer({
      name: 'annotation-visible-disabled',
      isHidden: false,
      isEnabled: false,
      query: {
        enable: false,
        name: '',
        iconColor: '',
      },
    }),
    controlsMenuEnabled: new DashboardAnnotationsDataLayer({
      name: 'annotation-controls-menu-enabled',
      isHidden: false,
      isEnabled: true,
      placement: 'inControlsMenu',
      query: {
        enable: true,
        name: '',
        iconColor: '',
      },
    }),
    controlsMenuDisabled: new DashboardAnnotationsDataLayer({
      name: 'annotation-controls-menu-disabled',
      isHidden: false,
      isEnabled: false,
      placement: 'inControlsMenu',
      query: {
        enable: false,
        name: '',
        iconColor: '',
      },
    }),
    hiddenBuiltIn: new DashboardAnnotationsDataLayer({
      name: 'annotation-hidden-builtin',
      isHidden: true,
      isEnabled: true,
      query: {
        builtIn: 1,
        enable: true,
        name: '',
        iconColor: '',
      },
    }),
    hiddenNotBuiltIn: new DashboardAnnotationsDataLayer({
      name: 'annotation-hidden-not-builtin',
      isHidden: true,
      isEnabled: true,
      query: {
        enable: true,
        name: '',
        iconColor: '',
      },
    }),
  };
}

describe('<DashboardAnnotationsList />', () => {
  test('renders 3 sections (one per visibility/placement) and an "Add annotation" button', async () => {
    const {
      visibleEnabled,
      visibleDisabled,
      controlsMenuEnabled,
      controlsMenuDisabled,
      hiddenBuiltIn,
      hiddenNotBuiltIn,
    } = buildTestAnnotations();

    const { getByRole, elements } = await renderAnnotationsList([
      visibleEnabled,
      visibleDisabled,
      controlsMenuEnabled,
      controlsMenuDisabled,
      hiddenBuiltIn,
      hiddenNotBuiltIn,
    ]);

    [/above dashboard/i, /controls menu/i, /hidden/i].forEach((name) => {
      expect(getByRole('heading', { name })).toBeInTheDocument();
    });

    const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
    expect(aboveNames).toEqual(['annotation-visible-enabled', '(Disabled) annotation-visible-disabled']); // order is preserved

    const controlsMenuNames = Array.from(elements.controlsMenuListItems()).map((item) => item.textContent);
    expect(controlsMenuNames).toEqual([
      'annotation-controls-menu-enabled',
      '(Disabled) annotation-controls-menu-disabled',
    ]);

    const hiddenNames = Array.from(elements.hiddenListItems()).map((item) => item.textContent);
    expect(hiddenNames).toEqual(['annotation-hidden-builtin (Built-in)', 'annotation-hidden-not-builtin']);

    expect(elements.addAnnotationButton()).toBeInTheDocument();
  });
});

test('always renders all 3 section titles even when some are empty', async () => {
  const { hiddenBuiltIn } = buildTestAnnotations();

  const { getByRole } = await renderAnnotationsList([hiddenBuiltIn]);

  [/above dashboard/i, /controls menu/i, /hidden/i].forEach((name) => {
    expect(getByRole('heading', { name })).toBeInTheDocument();
  });
});

describe('User interactions', () => {
  describe('when an annotation name is clicked', () => {
    test('selects the annotation in the pane', async () => {
      const { visibleEnabled } = buildTestAnnotations();

      const { user, getByText, elements } = await renderAnnotationsList([visibleEnabled]);

      await user.click(getByText(visibleEnabled.state.name));

      expect(elements.dashboardScene.state.editPane.selectObject).toHaveBeenCalledWith(visibleEnabled);
    });
  });

  describe('when the "Add annotation" button is clicked', () => {
    test('calls annotationEditActions.addAnnotation', async () => {
      const { visibleEnabled } = buildTestAnnotations();

      const { user, elements } = await renderAnnotationsList([visibleEnabled]);

      await user.click(elements.addAnnotationButton());

      expect(annotationEditActions.addAnnotation).toHaveBeenCalledWith({
        source: elements.dataLayerSet,
        addedObject: expect.objectContaining({
          state: expect.objectContaining({
            isEnabled: true,
            isHidden: false,
            name: NEW_ANNOTATION_NAME,
            query: {
              name: NEW_ANNOTATION_NAME,
              iconColor: NEW_ANNOTATION_COLOR,
              enable: true,
            },
          }),
        }),
      });
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

    test('reorders visible annotations when dragged down by one position', async () => {
      const { visibleEnabled, visibleDisabled, controlsMenuEnabled } = buildTestAnnotations();

      const { container, findByText, elements } = await renderAnnotationsList([
        visibleEnabled,
        visibleDisabled,
        controlsMenuEnabled,
      ]);

      await dragItem(container, findByText, 0, 'down');

      const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
      expect(aboveNames).toEqual(['(Disabled) annotation-visible-disabled', 'annotation-visible-enabled']);
    });
  });
});

describe('partitionAnnotationsByDisplay()', () => {
  test('separates annotations into 3 lists: visible, controlsMenu and hidden, while preserving order', () => {
    const {
      visibleEnabled,
      visibleDisabled,
      controlsMenuEnabled,
      controlsMenuDisabled,
      hiddenBuiltIn,
      hiddenNotBuiltIn,
    } = buildTestAnnotations();

    const { visible, controlsMenu, hidden } = partitionAnnotationsByDisplay([
      hiddenBuiltIn,
      controlsMenuEnabled,
      visibleDisabled,
      hiddenNotBuiltIn,
      controlsMenuDisabled,
      visibleEnabled,
    ]);

    expect(visible.length).toBe(2);
    expect(visible[0]).toBe(visibleDisabled);
    expect(visible[1]).toBe(visibleEnabled);

    expect(controlsMenu.length).toBe(2);
    expect(controlsMenu[0]).toBe(controlsMenuEnabled);
    expect(controlsMenu[1]).toBe(controlsMenuDisabled);

    expect(hidden.length).toBe(2);
    expect(hidden[0]).toBe(hiddenBuiltIn);
    expect(hidden[1]).toBe(hiddenNotBuiltIn);
  });

  test('returns empty lists when given no annotations', () => {
    const { visible, controlsMenu, hidden } = partitionAnnotationsByDisplay([]);

    expect(visible).toEqual([]);
    expect(controlsMenu).toEqual([]);
    expect(hidden).toEqual([]);
  });
});
