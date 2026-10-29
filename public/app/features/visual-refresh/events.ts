import { BusEventWithPayload } from '@grafana/data';

interface VisualRefreshFeedbackPayload {
  type: 'return' | 'nudge';
  theme?: string;
}

export class VisualRefreshFeedbackEvent extends BusEventWithPayload<VisualRefreshFeedbackPayload> {
  static type = 'visual-refresh-feedback';
}
