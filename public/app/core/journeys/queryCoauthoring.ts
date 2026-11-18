import {
  onInteraction,
  registerJourneyTriggers,
  onJourneyInstance,
  type StepHandle,
  type JourneyHandle,
} from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

/**
 * Journey: query_coauthoring
 * Entry click starts entry; session open completes it. Proposal staging starts
 * first_preview_outcome, completed by the first terminal outcome. Session closure
 * discards unfinished work; the registry supplies a five-minute timeout.
 */
const sessions = new WeakMap<JourneyHandle, string>();

registerJourneyTriggers('query_coauthoring', (tracker) => {
  return onInteraction('grafana_query_coauthoring_opened_popover', (props) => {
    const active = tracker.getActiveJourney('query_coauthoring');
    if (props.sessionId && (!active || sessions.get(active) !== str(props.sessionId))) {
      const handle = tracker.startJourney('query_coauthoring', {
        attributes: { sessionId: str(props.sessionId), source: str(props.source) },
      });
      sessions.set(handle, str(props.sessionId));
    }
  });
});

onJourneyInstance('query_coauthoring', (handle) => {
  const { add, cleanup } = collectUnsubs();
  const entry = handle.startStep('entry');
  let firstOutcome: StepHandle | undefined;
  add(
    onInteraction('grafana_query_coauthoring_session_opened', (props) => {
      if (str(props.sessionId) === sessions.get(handle)) {
        entry.end();
      }
    })
  );
  add(
    onInteraction('grafana_query_coauthoring_proposal_staged', (props) => {
      if (str(props.sessionId) === sessions.get(handle) && !firstOutcome) {
        firstOutcome = handle.startStep('first_preview_outcome');
      }
    })
  );
  add(
    onInteraction('grafana_query_coauthoring_preview_outcome_shown', (props) => {
      if (str(props.sessionId) === sessions.get(handle) && firstOutcome) {
        firstOutcome.end();
        handle.end('success');
      }
    })
  );
  add(
    onInteraction('grafana_query_coauthoring_dismissed_popover', (props) => {
      if (str(props.sessionId) === sessions.get(handle)) {
        handle.end('discarded');
      }
    })
  );
  return cleanup;
});
