import { useEffect } from 'react';

import { appEvents } from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';

import { VisualRefreshFeedbackEvent } from './events';

const NUDGE_DELAY_MS = 10 * 60 * 1000;

export function useVisualRefreshNudge(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !contextSrv.isSignedIn) {
      return;
    }
    const timeout = setTimeout(() => {
      appEvents.publish(new VisualRefreshFeedbackEvent({ type: 'nudge' }));
    }, NUDGE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [enabled]);
}
