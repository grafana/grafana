export interface MessagePacket {
  event: string;
  commentCreated: Message;
}

export interface Message {
  id: number;
  content: string;
  created: number;
  userId: number;
  user: User;
}

// TODO: Interface may exist elsewhere
export interface User {
  id: number;
  name: string;
  login: string;
  email: string;
  avatarUrl: string;
}
