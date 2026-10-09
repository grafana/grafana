import { BusEventWithPayload } from '@grafana/data';

interface VisualRefreshFeedbackPayload {
  type: 'return' | 'nudge';
}

export class VisualRefreshFeedbackEvent extends BusEventWithPayload<VisualRefreshFeedbackPayload> {
  static type = 'visual-refresh-feedback';
}
