export interface User {
  avatarUrl: string;
  email: string;
  lastSeenAt: string;
  lastSeenAtAge: string;
  login: string;
  orgId: number;
  role: string;
  userId: number;
}

export interface UsersState {
  users: User[];
  searchQuery: string;
}
