import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { canDeleteNotebooks, canEditNotebooks } from './permissions';

describe('canEditNotebooks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows editing for a user with notebooks:write', () => {
    const hasPermission = jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    expect(canEditNotebooks()).toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(AccessControlAction.NotebooksWrite);
  });

  it('refuses a user without it', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    expect(canEditNotebooks()).toBe(false);
  });
});

describe('canDeleteNotebooks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows deleting for a user with notebooks:write', () => {
    const hasPermission = jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    expect(canDeleteNotebooks()).toBe(true);
    // There is no separate deleter role, only reader and writer, so this checks write too.
    expect(hasPermission).toHaveBeenCalledWith(AccessControlAction.NotebooksWrite);
  });

  it('refuses a user without it', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    expect(canDeleteNotebooks()).toBe(false);
  });
});
