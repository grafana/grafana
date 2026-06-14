import { getSessionConflict, sessionWorkflowLabel } from './sessionConflict';

describe('sessionConflict', () => {
  it('parses a session conflict response', () => {
    const conflict = getSessionConflict({
      status: 409,
      data: {
        message: 'A snapshot is already being built for this session.',
        messageId: 'cloudmigrations.sessionBusy',
        workflow: 'building_snapshot',
        activeSnapshotUid: 'abc',
        canForce: true,
      },
    });

    expect(conflict).toEqual({
      message: 'A snapshot is already being built for this session.',
      messageId: 'cloudmigrations.sessionBusy',
      workflow: 'building_snapshot',
      activeSnapshotUid: 'abc',
      canForce: true,
    });
  });

  it('returns null for non-conflict errors', () => {
    expect(getSessionConflict({ status: 500, data: { message: 'nope' } })).toBeNull();
  });

  it('labels workflows for display', () => {
    expect(sessionWorkflowLabel('building_snapshot')).toBe('building a snapshot');
    expect(sessionWorkflowLabel('processing_snapshot')).toBe('processing a snapshot in Cloud');
  });
});
