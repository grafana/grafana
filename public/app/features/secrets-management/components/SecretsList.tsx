import { Secret } from '../types';

import { SecretItem } from './SecretItem';

interface SecretsListProps {
  secrets: Secret[];
  onEditSecret: (name: string) => void;
}

export function SecretsList({ secrets, onEditSecret }: SecretsListProps) {
  return (
    <ul>{secrets?.map((secret) => <SecretItem key={secret.uid} secret={secret} onEditSecret={onEditSecret} />)}</ul>
  );
}
