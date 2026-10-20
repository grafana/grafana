import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';

import { isApiMachineryError, type MetaStatusCause } from '../../apiserver/types';

type SaveDashboardErrorKind =
  | 'version-mismatch'
  | 'already-exists'
  | 'forbidden'
  | 'invalid'
  | 'plugin-dashboard'
  | 'unknown';

export interface SaveDashboardErrorInfo {
  kind: SaveDashboardErrorKind;
  /** Human readable explanation. Never empty, so the error alert never renders blank. */
  message: string;
  /** Field level validation failures. Only populated for `invalid`. */
  causes: string[];
}

// Dashboards are saved through the apiserver, which rejects with an apimachinery Status.
// Legacy `/api/dashboards/db` statuses are still recognised because provisioning and other
// non-apiserver paths can surface them.
const LEGACY_STATUS_KINDS: Record<string, SaveDashboardErrorKind> = {
  'version-mismatch': 'version-mismatch',
  'name-exists': 'already-exists',
  'plugin-dashboard': 'plugin-dashboard',
};

// `Conflict` and `AlreadyExists` are deliberately absent: both fall through to `unknown`, which
// shows the server's reason and leaves the save actions in place. Neither of the specialised
// recovery alerts describes what the apiserver actually reported, and each replaces the footer,
// so routing these reasons there hid the real message and removed the only way to retry.
//
// Conflict means a deleted object or a deprecatedInternalID collision, never a concurrent edit —
// the client strips metadata.resourceVersion before writing, so that precondition never runs, and
// the v2 client ignores `overwrite`, so "save and overwrite" resends the identical request.
//
// AlreadyExists is a uid collision rather than a title clash, so advising a different name or
// folder is wrong even in Save As, where those fields exist.
//
// The legacy statuses keep their mappings: `name-exists` really is a title collision.
const API_MACHINERY_REASON_KINDS: Record<string, SaveDashboardErrorKind> = {
  Forbidden: 'forbidden',
  Invalid: 'invalid',
};

export function getSaveDashboardErrorInfo(error: unknown): SaveDashboardErrorInfo | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  if (isApiMachineryError(error)) {
    return {
      kind: API_MACHINERY_REASON_KINDS[error.data.reason ?? ''] ?? 'unknown',
      message: resolveMessage(error),
      causes: formatCauses(error.data.details?.causes),
    };
  }

  if (isFetchError(error)) {
    return {
      kind: LEGACY_STATUS_KINDS[error.data?.status] ?? 'unknown',
      message: resolveMessage(error),
      causes: [],
    };
  }

  return {
    kind: 'unknown',
    message: error instanceof Error && error.message ? error.message : genericMessage(),
    causes: [],
  };
}

function formatCauses(causes?: MetaStatusCause[]): string[] {
  if (!causes) {
    return [];
  }

  return causes.flatMap((cause) => {
    if (!cause.message) {
      return [];
    }
    return [cause.field ? `${cause.field}: ${cause.message}` : cause.message];
  });
}

/**
 * A FetchError is built from the response, so it has no `message` of its own — the server text
 * lives in `data.message`. Walk every source before giving up so the alert always says something.
 */
function resolveMessage(error: unknown): string {
  if (isFetchError(error)) {
    if (error.data?.message) {
      return error.data.message;
    }
    if (error.message) {
      return error.message;
    }
    if (error.statusText) {
      return `${error.status} ${error.statusText}`;
    }
  }

  return genericMessage();
}

function genericMessage(): string {
  return t('dashboard-scene.save-errors.unexpected', 'An unexpected error occurred while saving.');
}
