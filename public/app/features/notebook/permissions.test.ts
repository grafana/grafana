import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { canAddPanelToNotebook, canCreateNotebooks, canDeleteNotebooks, canEditNotebooks } from './permissions';

/** Grants exactly these actions and nothing else. */
function grant(...actions: AccessControlAction[]) {
  jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => actions.some((granted) => granted === action));
}

describe('notebook permissions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // One action per verb, as the apiserver authorizes them. The fixed writer role bundles all four,
  // so these only come apart for a custom role — which is exactly where checking the wrong one
  // hides an affordance a user is entitled to, or offers one the backend will refuse.
  it.each([
    ['canEditNotebooks', canEditNotebooks, AccessControlAction.NotebooksWrite],
    ['canCreateNotebooks', canCreateNotebooks, AccessControlAction.NotebooksCreate],
    ['canDeleteNotebooks', canDeleteNotebooks, AccessControlAction.NotebooksDelete],
  ])('%s keys off its own action alone', (_name, can, action) => {
    grant(action);
    expect(can()).toBe(true);

    const others = [
      AccessControlAction.NotebooksRead,
      AccessControlAction.NotebooksWrite,
      AccessControlAction.NotebooksCreate,
      AccessControlAction.NotebooksDelete,
    ].filter((other) => other !== action);

    grant(...others);
    expect(can()).toBe(false);
  });

  // The picker offers two routes — adding to an existing notebook needs write, creating one needs
  // create — so either is enough to open it, and the modal hides the tab the user cannot use.
  describe('canAddPanelToNotebook', () => {
    it.each([
      ['write only', [AccessControlAction.NotebooksWrite]],
      ['create only', [AccessControlAction.NotebooksCreate]],
      ['both', [AccessControlAction.NotebooksWrite, AccessControlAction.NotebooksCreate]],
    ])('opens the picker with %s', (_name, actions) => {
      grant(...actions);

      expect(canAddPanelToNotebook()).toBe(true);
    });

    it('stays shut for a reader who can do neither', () => {
      grant(AccessControlAction.NotebooksRead);

      expect(canAddPanelToNotebook()).toBe(false);
    });
  });
});
