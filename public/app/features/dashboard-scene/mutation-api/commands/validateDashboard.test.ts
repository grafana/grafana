import type { DashboardScene } from '../../scene/DashboardScene';
import { getDashboardValidationIssues } from '../../validation/getDashboardValidationIssues';

import { validateDashboardCommand } from './validateDashboard';

jest.mock('../../validation/getDashboardValidationIssues', () => ({
  getDashboardValidationIssues: jest.fn(),
}));

const getIssuesMock = getDashboardValidationIssues as jest.MockedFunction<typeof getDashboardValidationIssues>;

const scene = { state: {} } as unknown as DashboardScene;

describe('VALIDATE_DASHBOARD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is read-only and requires no permissions', () => {
    expect(validateDashboardCommand.readOnly).toBe(true);
    expect(validateDashboardCommand.permission(scene)).toEqual({ allowed: true });
  });

  it('returns the detected issues as data', async () => {
    getIssuesMock.mockReturnValue({ undefinedVariables: ['env', 'cluster'] });

    const result = await validateDashboardCommand.handler({}, { scene });

    expect(getIssuesMock).toHaveBeenCalledWith(scene);
    expect(result).toEqual({
      success: true,
      data: { undefinedVariables: ['env', 'cluster'] },
      changes: [],
    });
  });

  it('reports no issues on a clean dashboard', async () => {
    getIssuesMock.mockReturnValue({ undefinedVariables: [] });

    const result = await validateDashboardCommand.handler({}, { scene });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ undefinedVariables: [] });
  });

  it('surfaces a failure when validation throws', async () => {
    getIssuesMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = await validateDashboardCommand.handler({}, { scene });

    expect(result).toEqual({ success: false, error: 'boom', changes: [] });
  });
});
