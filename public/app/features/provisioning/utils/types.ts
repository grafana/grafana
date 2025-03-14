// TODO: This file should be removed when the swagger docs match the real payloads

export type FileDetails = {
  path: string;
  size: string;
  hash: string;
};

export type HistoryListResponse = {
  apiVersion?: string;
  kind?: string;
  metadata?: any;
  items?: HistoryItem[];
};

export type HistoryItem = {
  ref: string;
  message: string;
  createdAt?: number;
  authors: AuthorInfo[];
};

export type AuthorInfo = {
  name: string;
  username: string;
  avatarURL?: string;
};
