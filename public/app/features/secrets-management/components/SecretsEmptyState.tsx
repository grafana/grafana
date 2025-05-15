import { Button, EmptyState } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

interface SecretsEmptyStateProps {
  onCreateSecret: () => void;
}

export function SecretsEmptyState({ onCreateSecret }: SecretsEmptyStateProps) {
  return (
    <EmptyState
      variant="call-to-action"
      button={
        <Button onClick={onCreateSecret} icon="plus">
          <Trans i18nKey="secrets-management.page.actions.create-secret">Create secret</Trans>
        </Button>
      }
      message={t('secrets-management.empty-state.title', "You don't have any secrets yet.")}
    >
      <Trans i18nKey="secrets-management.empty-state.more-info">
        You can use secrets to store private information such as passwords, API keys and other sensitive data.
      </Trans>
    </EmptyState>
  );
}
