export interface User {
  id: number;
  name: string;
  avatarUrl: string;
}

export interface PinCoord {
  panelKey: string;
  xNorm: number;
  yNorm: number;
}

export interface PinContext {
  panelTitle: string;
  timeRange: { from: string; to: string };
  timestampHint?: string;
}

export interface CommentMessage {
  id: number;
  threadId: number;
  author: User;
  body: string;
  createdAt: string;
}

export interface CommentThread {
  id: number;
  dashboardUid: string;
  anchor: PinCoord;
  context: PinContext;
  resolved: boolean;
  createdBy: User;
  createdAt: string;
  messages: CommentMessage[];
}
