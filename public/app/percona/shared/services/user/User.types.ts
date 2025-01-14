export interface UserStatusResponse {
  is_platform_user: boolean;
}

export interface UserDetailsResponse {
  user_id: number;
  product_tour_completed?: boolean;
  alerting_tour_completed?: boolean;
  snoozed_api_keys_migration?: boolean;
  snoozed_pmm_version?: string;
}

export interface UserDetailsPutPayload {
  product_tour_completed?: boolean;
  alerting_tour_completed?: boolean;
  snoozed_pmm_version?: string;
  snoozed_api_keys_migration?: boolean;
}

export interface UserListItemResponse {
  user_id: number;
  role_ids: number[];
}

export interface UserListResponse {
  users: UserListItemResponse[];
}
