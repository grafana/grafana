import { useEffect } from 'react';

import { UserStorage } from '@grafana/runtime/internal';
import { appEvents } from 'app/core/app_events';

import { NotebooksFeedbackEvent } from './notebooksFeedbackEvent';

const userStorage = new UserStorage('notebooks');
const VISIT_COUNT_KEY = 'feedback-toast-visit-count';
const FEEDBACK_INTERVAL = 5;

// Fires the GMF notebooks-feedback event every 5th notebook visit. Permanent dismissal
// (submit or close) is handled entirely on the grafana-setupguide-app side.
export function useTrackNotebookVisitForFeedback() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await userStorage.getItem(VISIT_COUNT_KEY);
      const previousCount = stored && Number.isFinite(Number(stored)) ? Number(stored) : 0;
      const count = previousCount + 1;

      if (cancelled) {
        return;
      }

      await userStorage.setItem(VISIT_COUNT_KEY, String(count));

      if (count % FEEDBACK_INTERVAL === 0) {
        appEvents.publish(new NotebooksFeedbackEvent());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
