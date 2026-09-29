import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NOTEBOOKS_FLAG } from '../test-utils';

import { requiresNotebookCreate, requiresNotebookEdit, requiresNotebookRead } from './permissions';

/** Grants exactly these actions and nothing else. */
function grant(...actions: AccessControlAction[]) {
  jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => actions.some((granted) => granted === action));
}

describe('notebook mutation command permissions', () => {
  beforeEach(() => {
    setTestFlags({ [NOTEBOOKS_FLAG]: true });
  });

  afterEach(() => {
    setTestFlags({});
    jest.restoreAllMocks();
  });

  // One action per verb, matching what the apiserver authorizes. A blanket true/false mock would
  // pass even if a command asked for the wrong action, so each case grants only its own action and
  // then everything else, to catch exactly that.
  it.each([
    ['requiresNotebookRead', requiresNotebookRead, AccessControlAction.NotebooksRead],
    ['requiresNotebookEdit', requiresNotebookEdit, AccessControlAction.NotebooksWrite],
    ['requiresNotebookCreate', requiresNotebookCreate, AccessControlAction.NotebooksCreate],
  ])('%s keys off its own action alone', (_name, check, action) => {
    grant(action);
    expect(check().allowed).toBe(true);

    const others = [
      AccessControlAction.NotebooksRead,
      AccessControlAction.NotebooksWrite,
      AccessControlAction.NotebooksCreate,
      AccessControlAction.NotebooksDelete,
    ].filter((other) => other !== action);

    grant(...others);
    expect(check().allowed).toBe(false);
  });
});
