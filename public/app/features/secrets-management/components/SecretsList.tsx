import { Secret } from '../types';
import { transformSecretName } from '../utils';

import { SecretItem } from './SecretItem';
import { SecretsEmptyState } from './SecretsEmptyState';
import { SecretsSearchEmptyState } from './SecretsSearchEmptyState';

interface SecretsListProps {
  secrets?: Secret[];
  filter?: string;
  onEditSecret: (name: string) => void;
  onDeleteSecret: (name: string) => void;
  onCreateSecret: () => void;
}

export function SecretsList({ secrets = [], onEditSecret, onDeleteSecret, filter, onCreateSecret }: SecretsListProps) {
  const hasSecrets = secrets.length > 0;
  const filteredSecrets = !filter
    ? secrets
    : secrets.filter((secret) => secret.name.includes(transformSecretName(filter) || ''));
  const hasFilteredSecrets = filteredSecrets.length > 0;

  if (!hasSecrets) {
    return <SecretsEmptyState onCreateSecret={onCreateSecret} />;
  }

  if (hasSecrets && !hasFilteredSecrets) {
    return <SecretsSearchEmptyState />;
  }

  return (
    <>
      <ul>
        {filteredSecrets.map((secret) => (
          <SecretItem key={secret.uid} secret={secret} onEditSecret={onEditSecret} onDeleteSecret={onDeleteSecret} />
        ))}
      </ul>
    </>
  );
}
