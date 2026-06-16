import { fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DashboardLink, type DashboardLinkPlacement } from '@grafana/schema';

import { DashboardScene } from '../../scene/DashboardScene';
import { createDefaultLink, openLinkEditPane } from '../../settings/links/LinkAddEditableElement';
import { activateFullSceneTree } from '../../utils/test-utils';

import { DashboardLinksList, partitionLinksByPlacement } from './DashboardLinksList';

jest.mock('../../settings/links/LinkAddEditableElement', () => ({
  ...jest.requireActual('../../settings/links/LinkAddEditableElement'),
  openAddLinkPane: jest.fn(),
  openLinkEditPane: jest.fn(),
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

function renderLinksList(links: DashboardLink[] = []) {
  const user = userEvent.setup();

  const dashboardScene = new DashboardScene({
    links,
    isEditing: true,
  });
  activateFullSceneTree(dashboardScene);
  jest.spyOn(dashboardScene.state.editPane, 'selectObject');

  const renderResult = render(<DashboardLinksList dashboard={dashboardScene} />);

  return {
    ...renderResult,
    user,
    elements: {
      dashboardScene,
      aboveListItems: () => within(renderResult.getByTestId('links-list-visible')).getAllByTestId('link-title'),
      controlsMenuListItems: () =>
        within(renderResult.getByTestId('links-list-controls-menu')).getAllByTestId('link-title'),
    },
  };
}

function buildLinks() {
  const defaultLink = createDefaultLink();

  return {
    visibleLink1: {
      ...defaultLink,
      title: 'visibleLink1',
    },
    visibleLink2: {
      ...defaultLink,
      title: 'visibleLink2',
    },
    controlsMenuLink1: {
      ...defaultLink,
      title: 'controlsMenuLink1',
      placement: 'inControlsMenu' as DashboardLinkPlacement,
    },
  };
}

describe('<DashboardLinksList />', () => {
  test('renders 2 sections (one per link display type)', () => {
    const { visibleLink1, visibleLink2, controlsMenuLink1 } = buildLinks();
    const { getByRole, elements } = renderLinksList([controlsMenuLink1, visibleLink2, visibleLink1]);

    [/above dashboard/i, /controls menu/i].forEach((name) => {
      expect(getByRole('heading', { name })).toBeInTheDocument();
    });

    const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
    expect(aboveNames).toEqual(['visibleLink2', 'visibleLink1']); // order is preserved

    const controlsMenuNames = Array.from(elements.controlsMenuListItems()).map((item) => item.textContent);
    expect(controlsMenuNames).toEqual(['controlsMenuLink1']);
  });

  test('always renders the 2 section titles even if one is empty', () => {
    const { controlsMenuLink1 } = buildLinks();
    const { getByRole } = renderLinksList([controlsMenuLink1]);

    [/above dashboard/i, /controls menu/i].forEach((name) => {
      expect(getByRole('heading', { name })).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    describe('when a link title is clicked', () => {
      test('selects the link in the pane', async () => {
        const { visibleLink1 } = buildLinks();
        const { user, getByText, elements } = renderLinksList([visibleLink1]);

        await user.click(getByText(visibleLink1.title));

        expect(openLinkEditPane).toHaveBeenCalledWith(elements.dashboardScene, 0);
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

      test('reorders visible links when dragged down by one position', async () => {
        const { visibleLink1, visibleLink2, controlsMenuLink1 } = buildLinks();
        const { container, findByText, elements } = renderLinksList([visibleLink1, visibleLink2, controlsMenuLink1]);

        await dragItem(container, findByText, 0, 'down');

        const aboveNames = Array.from(elements.aboveListItems()).map((item) => item.textContent);
        expect(aboveNames).toEqual(['visibleLink2', 'visibleLink1']);
      });
    });
  });
});

describe('partitionLinksByPlacement()', () => {
  test('separates links into 2 lists: visible and controlsMenu, while preserving order', () => {
    const { visibleLink1, visibleLink2, controlsMenuLink1 } = buildLinks();

    const { visible, controlsMenu } = partitionLinksByPlacement([visibleLink2, visibleLink1, controlsMenuLink1]);

    expect(visible.length).toBe(2);
    expect(visible[0]).toEqual(expect.objectContaining(visibleLink2)); // we make links Scene-like for DraggableList
    expect(visible[1]).toEqual(expect.objectContaining(visibleLink1)); // we make links Scene-like for DraggableList

    expect(controlsMenu.length).toBe(1);
    expect(controlsMenu[0]).toEqual(expect.objectContaining(controlsMenuLink1)); // we make links Scene-like for DraggableList
  });

  test('returns empty lists when given no links', () => {
    const { visible, controlsMenu } = partitionLinksByPlacement([]);

    expect(visible).toEqual([]);
    expect(controlsMenu).toEqual([]);
  });
});
