export enum DashboardEventAction {
  Saved = 'saved',
  EditingStarted = 'editing-started', // Sent when someone (who can save!) opens the editor
  EditingCanceled = 'editing-cancelled', // Sent when someone discards changes, or unsubscribes while editing
  Deleted = 'deleted',
}

export interface DashboardEvent {
  uid: string;
  action: DashboardEventAction;
  userId?: number;
  message?: string;
  sessionId?: string;
}
