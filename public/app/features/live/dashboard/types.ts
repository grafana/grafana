export enum DashboardUpdateMode {
  Ignore = 'ignore',
  AutoUpdate = 'update',
  ShowNotice = 'notice',
  Ask = 'ask', // The default
}

export enum DashboardEventAction {
  Saved = 'saved',
  Editing = 'editing', // Sent when someone goes to the editor
  Deleted = 'deleted',
}

export interface DashboardEvent {
  uid: string;
  action: DashboardEventAction;
  userId: number;
  sessionId?: string;
}

/**
 * This gets saved in local storage
 */
export interface DashboardWatchSettings {
  updateMode: DashboardUpdateMode;
}
