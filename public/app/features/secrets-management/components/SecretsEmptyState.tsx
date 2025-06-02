import { Button, EmptyState } from '@grafana/ui';

import { t, Trans } from '../../../core/internationalization';

interface SecretsEmptyStateProps {
  onCreateSecret: () => void;
}

export function SecretsEmptyState({ onCreateSecret }: SecretsEmptyStateProps) {
  return (
    <EmptyState
      variant="call-to-action"
      button={
        <Button onClick={onCreateSecret} icon="plus">
          <Trans i18nKey="secrets.actions.create-secret">Create secret</Trans>
        </Button>
      }
      message={t('secrets.empty-state.title', "You don't have any secrets yet.")}
    >
      <Trans i18nKey="secrets.empty-state.description">
        You can use secrets to store private information such as passwords, API keys and other sensitive data.
      </Trans>
    </EmptyState>
  );
}
