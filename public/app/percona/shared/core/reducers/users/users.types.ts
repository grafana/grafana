export interface UserItem {
  userId: number;
  roleIds: number[];
}

export interface UsersState {
  isLoading: boolean;
  users: UserItem[];
  usersMap: Record<number, UserItem>;
}
