// TODO: This file should be removed when the swagger docs match the real payloads

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
