export interface ChangePasswordFields {
  oldPassword: string;
  newPassword: string;
  confirmNew: string;
}

export interface ProfileUpdateFields {
  name: string;
  email: string;
  login: string;
}
