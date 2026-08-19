import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { canEditNotebooks } from './permissions';

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
