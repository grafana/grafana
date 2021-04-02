export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  firstName: string;
  lastName: string;
}

export type SignUpPayload = SignUpCredentials;

export interface SignUpProps {
  userEmail: string | undefined;
  getSettings: () => void;
}

export interface LoginFormProps {
  getSettings: () => void;
  changeMode: () => void;
}
