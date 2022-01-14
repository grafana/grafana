export interface CredentialsForm {
  aws_access_key: string;
  aws_secret_key: string;
}

export interface CredentialsProps {
  onSetCredentials: (CredentialsForm) => void;
}
