export interface Notification {
  metadata: { name: string; namespace: string; creationTimestamp: string };
  spec: {
    recipientUID: string;
    orgID: number;
    type: 'mention' | 'reply';
    createdAt: string;
    source: {
      kind: 'comment';
      commentUID: string;
      threadUID: string;
      dashboardUID: string;
      deepLink: string;
    };
    actor: { uid: string; login: string; name: string };
    excerpt: string;
  };
}

export interface NotificationList {
  items: Notification[];
  metadata: { continue?: string };
}
