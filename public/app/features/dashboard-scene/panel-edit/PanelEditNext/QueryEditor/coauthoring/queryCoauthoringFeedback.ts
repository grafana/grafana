import { BusEventWithPayload } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

export interface QueryCoauthoringFeedbackState {
  outcome: 'proposal' | 'handoff';
  rating: -1 | 1;
}

class QueryCoauthoringFeedbackEvent extends BusEventWithPayload<QueryCoauthoringFeedbackState> {
  static type = 'query-coauthoring-feedback';
}

export function publishQueryCoauthoringFeedback({ rating, outcome }: QueryCoauthoringFeedbackState) {
  getAppEvents().publish(new QueryCoauthoringFeedbackEvent({ rating, outcome }));
}
