import { Button, EmptyState } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

interface ZeroStateProps {
  onCreateSecret: () => void;
}

export function ZeroState({ onCreateSecret }: ZeroStateProps) {
  return (
    <EmptyState
      variant="call-to-action"
      button={
        <Button
          // disabled={!contextSrv.hasPermission(AccessControlAction.SecretsManagementCreate)}
          onClick={onCreateSecret}
          icon="plus"
          size="lg"
        >
          <Trans i18nKey="secrets-management.empty-state.button-title">Add secret</Trans>
        </Button>
      }
      message={t('secrets-management.empty-state.title', "You haven't created any secrets yet")}
    >
      <Trans i18nKey="secrets-management.empty-state.more-info">
        Remember, you can provide specific permissions for API access to other applications
      </Trans>
    </EmptyState>
  );
}
