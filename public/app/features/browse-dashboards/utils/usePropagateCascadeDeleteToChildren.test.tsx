import { render } from 'test/test-utils';

import { fullyLoadedViewItemCollection } from '../fixtures/state.fixtures';

import { usePropagateCascadeDeleteToChildren } from './usePropagateCascadeDeleteToChildren';

const preloadedState = {
  browseDashboards: {
    rootItems: undefined,
    childrenByParentUID: {
      'folder-1': fullyLoadedViewItemCollection([
        { kind: 'folder' as const, uid: 'child-folder', title: 'Child folder' },
        { kind: 'dashboard' as const, uid: 'child-dashboard', title: 'Child dashboard' },
      ]),
    },
    openFolders: {},
    selectedItems: { $all: false, dashboard: {}, folder: {}, panel: {} },
    cascadeDeletingUIDs: {},
    cascadeDeleteErrors: {},
  },
};

function TestComponent({ isDeleting, errors }: { isDeleting: boolean; errors?: string[] }) {
  usePropagateCascadeDeleteToChildren('folder-1', isDeleting, errors);
  return null;
}

describe('usePropagateCascadeDeleteToChildren', () => {
  it('marks already-loaded children as cascade-deleting', () => {
    const { store } = render(<TestComponent isDeleting />, { preloadedState });

    expect(store?.getState().browseDashboards.cascadeDeletingUIDs).toEqual({
      'child-folder': true,
      'child-dashboard': true,
    });
  });

  it('does nothing while not deleting', () => {
    const { store } = render(<TestComponent isDeleting={false} />, { preloadedState });

    expect(store?.getState().browseDashboards.cascadeDeletingUIDs).toEqual({});
  });

  it('marks a child named in one of the parent errors as errored too', () => {
    const errors = ['delete child folder child-folder: folder is not empty'];
    const { store } = render(<TestComponent isDeleting errors={errors} />, { preloadedState });

    expect(store?.getState().browseDashboards.cascadeDeleteErrors).toEqual({
      'child-folder': errors,
    });
  });

  it('does not mark a child as errored when no error names it', () => {
    const errors = ['delete dashboard some-other-uid: locked'];
    const { store } = render(<TestComponent isDeleting errors={errors} />, { preloadedState });

    expect(store?.getState().browseDashboards.cascadeDeleteErrors).toEqual({});
  });
});
