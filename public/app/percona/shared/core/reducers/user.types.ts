export interface UserDetails {
  userId: number;
  productTourCompleted: boolean;
}

export interface PerconaUserState extends UserDetails {
  isAuthorized: boolean;
  isPlatformUser: boolean;
}
