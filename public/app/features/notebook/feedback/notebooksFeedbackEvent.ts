import { BusEventBase } from '@grafana/data';

// Must match the event type grafana-setupguide-app listens for (docs/global-messaging.md,
// src/hooks/events/notebooks-feedback.ts) to trigger the Notebooks GMF survey toast.
export class NotebooksFeedbackEvent extends BusEventBase {
  static type = 'notebooks-feedback';
}
