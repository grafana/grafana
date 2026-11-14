import { BusEventWithPayload } from '@grafana/data';

export class NotebookFeedbackFormRequestEvent extends BusEventWithPayload<{ action: 'open' | 'status' }> {
  static type = 'notebook-feedback-form-request';
}

export class NotebookFeedbackFormStateEvent extends BusEventWithPayload<{
  state: 'available' | 'open' | 'submitted' | 'unavailable';
}> {
  static type = 'notebook-feedback-form-state';
}
