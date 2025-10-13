export interface UserDetails {
  userId: number;
  productTourCompleted: boolean;
  alertingTourCompleted: boolean;
  snoozedPmmVersion?: string;
}

export interface PerconaUserState extends UserDetails {
  isAuthorized: boolean;
  isPlatformUser: boolean;
}
