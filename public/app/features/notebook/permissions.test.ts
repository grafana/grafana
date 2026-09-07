import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { canDeleteNotebooks, canEditNotebooks } from './permissions';

describe('canEditNotebooks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows editing for a user with dashboards:write', () => {
    const hasPermission = jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    expect(canEditNotebooks()).toBe(true);
    // Notebooks reuse the dashboard action rather than one of their own, so pin which is asked for.
    expect(hasPermission).toHaveBeenCalledWith(AccessControlAction.DashboardsWrite);
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

  it('allows deleting for a user with dashboards:delete', () => {
    const hasPermission = jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    expect(canDeleteNotebooks()).toBe(true);
    // Delete is its own action, not write - pin which one is asked for, since both are truthy for
    // most users and a mix-up would only show up as a missing menu item for the few where they differ.
    expect(hasPermission).toHaveBeenCalledWith(AccessControlAction.DashboardsDelete);
  });

  it('refuses a user without it', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    expect(canDeleteNotebooks()).toBe(false);
  });
});
