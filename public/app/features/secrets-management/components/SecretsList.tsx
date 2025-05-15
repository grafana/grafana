import { Secret } from '../types';

import { SecretItem } from './SecretItem';
import { SecretsSearchEmptyState } from './SecretsSearchEmptyState';

interface SecretsListProps {
  secrets: Secret[];
  filter?: string;
  onEditSecret: (name: string) => void;
  onDeleteSecret: (name: string) => void;
}

export function SecretsList({ secrets, onEditSecret, onDeleteSecret, filter }: SecretsListProps) {
  const hasSecrets = secrets.length > 0;
  const filteredSecrets = filter
    ? secrets
    : secrets.filter((secret) => secret.name.toLowerCase().includes(filter?.toLowerCase() || ''));
  const hasFilteredSecrets = filteredSecrets.length > 0;

  if (hasSecrets && !hasFilteredSecrets) {
    return <SecretsSearchEmptyState />;
  }

  return (
    <ul>
      {filteredSecrets.map((secret) => (
        <SecretItem key={secret.uid} secret={secret} onEditSecret={onEditSecret} onDeleteSecret={onDeleteSecret} />
      ))}
    </ul>
  );
}
