/**
 * View model for {@link StartInvestigationButton}.
 * The hook owns plugin/feature gating, request identity, RTK Query calls, and polling.
 */
export type StartInvestigationViewModel =
  | { status: 'hidden' }
  | { status: 'waitingIdentity' }
  | { status: 'lookingUp' }
  | { status: 'lookupError'; onRetry: () => void }
  | { status: 'completed'; href: string; investigationId: string; onOpenReport: () => void }
  | { status: 'starting' }
  | { status: 'startError'; onStart: () => void }
  | {
      status: 'reportFailed';
      href: string;
      investigationId: string;
      onStart: () => void;
      onOpenReport: () => void;
    }
  | {
      status: 'pollError';
      href: string;
      investigationId: string;
      onRetry: () => void;
      onWatchLive: () => void;
    }
  | { status: 'running'; href: string; investigationId: string; onWatchLive: () => void }
  | { status: 'idle'; onStart: () => void };
