export interface UserDetails {
  userId: number;
  productTourCompleted: boolean;
  alertingTourCompleted: boolean;
}

export interface PerconaUserState extends UserDetails {
  isAuthorized: boolean;
  isPlatformUser: boolean;
}
