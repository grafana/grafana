import { MutationRequest } from './protocol/messages';

/**
 * Maps a MutationRequest to the lock target that must be held for the operation.
 * Returns empty string if no lock is required (e.g., ADD_PANEL).
 */
export function getLockTarget(mutation: MutationRequest): string {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- payload is typed as unknown in the protocol; runtime checks follow
  const payload = mutation.payload as Record<string, unknown> | undefined;

  switch (mutation.type) {
    // Panel-scoped operations lock the specific panel by element name
    case 'UPDATE_PANEL':
    case 'REMOVE_PANEL':
    case 'MOVE_PANEL': {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structural narrowing of unknown payload
      const element = payload?.element as Record<string, unknown> | undefined;
      return typeof element?.name === 'string' ? element.name : '';
    }

    // ADD_PANEL does not require a lock
    case 'ADD_PANEL':
      return '';

    // Variable operations share a single lock target
    case 'ADD_VARIABLE':
    case 'UPDATE_VARIABLE':
    case 'REMOVE_VARIABLE':
      return '__variables__';

    // Layout operations (rows, tabs, grid) share a single lock target
    case 'ADD_ROW':
    case 'REMOVE_ROW':
    case 'UPDATE_ROW':
    case 'MOVE_ROW':
    case 'ADD_TAB':
    case 'REMOVE_TAB':
    case 'UPDATE_TAB':
    case 'MOVE_TAB':
    case 'UPDATE_LAYOUT':
      return '__layout__';

    // Dashboard-level metadata
    case 'UPDATE_DASHBOARD_INFO':
      return '__dashboard__';

    default:
      return '';
  }
}
