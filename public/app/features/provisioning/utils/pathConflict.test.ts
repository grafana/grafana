import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

import { getPathConflictCondition, getPathConflictWarningTitle } from './pathConflict';

function makeCondition(overrides: Partial<Condition> = {}): Condition {
  return {
    type: 'PathConflict',
    status: 'False',
    reason: 'PathConflict',
    message: 'repository path conflicts with existing repository: other-repo',
    lastTransitionTime: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getPathConflictCondition', () => {
  it('returns undefined when conditions is undefined', () => {
    expect(getPathConflictCondition(undefined)).toBeUndefined();
  });

  it('returns undefined when conditions is empty', () => {
    expect(getPathConflictCondition([])).toBeUndefined();
  });

  it('returns undefined when no condition has type PathConflict', () => {
    const conditions = [makeCondition({ type: 'NamespaceQuota', reason: 'WithinQuota' })];
    expect(getPathConflictCondition(conditions)).toBeUndefined();
  });

  it('returns undefined when the PathConflict condition reports no conflict', () => {
    const conditions = [
      makeCondition({
        status: 'True',
        reason: 'NoPathConflict',
        message: 'no other repository shares this URL, branch, and path',
      }),
    ];
    expect(getPathConflictCondition(conditions)).toBeUndefined();
  });

  it('returns the condition when it reports a conflict', () => {
    const condition = makeCondition();
    expect(getPathConflictCondition([condition])).toEqual(condition);
  });

  it('finds the PathConflict condition among other conditions', () => {
    const condition = makeCondition();
    const conditions = [
      makeCondition({ type: 'NamespaceQuota', reason: 'WithinQuota', status: 'True' }),
      condition,
      makeCondition({ type: 'Ready', reason: 'Available', status: 'True' }),
    ];
    expect(getPathConflictCondition(conditions)).toEqual(condition);
  });
});

describe('getPathConflictWarningTitle', () => {
  it('returns a non-empty title', () => {
    expect(getPathConflictWarningTitle().length).toBeGreaterThan(0);
  });

  it('returns the same title on every call, so the wizard and overview never diverge', () => {
    expect(getPathConflictWarningTitle()).toEqual(getPathConflictWarningTitle());
  });
});
