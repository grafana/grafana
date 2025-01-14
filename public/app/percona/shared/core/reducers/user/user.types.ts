export interface UserDetails {
  userId: number;
  snoozedApiKeysMigration: boolean;
  productTourCompleted: boolean;
  alertingTourCompleted: boolean;
  snoozedPmmVersion?: string;
}

export interface PerconaUserState extends UserDetails {
  isAuthorized: boolean;
  isPlatformUser: boolean;
}
