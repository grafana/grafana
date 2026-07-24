import { isFetchError } from '@grafana/runtime';

export interface SessionConflictDetails {
  message: string;
  messageId: string;
  workflow: SessionWorkflow;
  activeSnapshotUid?: string;
  canForce: boolean;
}

export type SessionWorkflow =
  | 'idle'
  | 'building_snapshot'
  | 'uploading_snapshot'
  | 'processing_snapshot';

export function getSessionConflict(err: unknown): SessionConflictDetails | null {
  if (!isFetchError<SessionConflictDetails>(err) || err.status !== 409) {
    return null;
  }

  const data = err.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const message = 'message' in data && typeof data.message === 'string' ? data.message : null;
  const messageId = 'messageId' in data && typeof data.messageId === 'string' ? data.messageId : null;
  const workflow = 'workflow' in data && typeof data.workflow === 'string' ? data.workflow : null;
  const canForce = 'canForce' in data && typeof data.canForce === 'boolean' ? data.canForce : false;
  const activeSnapshotUid =
    'activeSnapshotUid' in data && typeof data.activeSnapshotUid === 'string'
      ? data.activeSnapshotUid
      : undefined;

  if (!message || !messageId || !workflow) {
    return null;
  }

  return {
    message,
    messageId,
    workflow: workflow as SessionWorkflow,
    activeSnapshotUid,
    canForce,
  };
}

export function sessionWorkflowLabel(workflow: SessionWorkflow): string {
  switch (workflow) {
    case 'building_snapshot':
      return 'building a snapshot';
    case 'uploading_snapshot':
      return 'uploading a snapshot';
    case 'processing_snapshot':
      return 'processing a snapshot in Cloud';
    default:
      return 'running a migration operation';
  }
}
