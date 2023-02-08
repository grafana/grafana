export interface UserStatusResponse {
  is_platform_user: boolean;
}

export interface UserDetailsResponse {
  user_id: number;
  product_tour_completed?: boolean;
  alerting_tour_completed?: boolean;
}

export interface UserDetailsPutPayload {
  product_tour_completed?: boolean;
  alerting_tour_completed?: boolean;
}

export interface UserListItemResponse {
  user_id: number;
  role_ids: number[];
}

export interface UserListResponse {
  users: UserListItemResponse[];
}
