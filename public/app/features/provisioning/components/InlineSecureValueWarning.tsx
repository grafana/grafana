import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

interface Props {
  repo?: Repository;
  items?: Repository[];
}

// TODO: remove this after 12.2
export function InlineSecureValueWarning({ repo, items }: Props) {
  const isRepoValid = (r?: Repository) => r?.spec?.type === 'local' || !!r?.secure?.token?.name;

  if (isRepoValid(repo)) {
    return null;
  }

  // When a list is passed in, show an error if anything is missing
  if (items?.every(isRepoValid)) {
    return null;
  }

  return (
    <Alert
      title={t(
        'provisioning.inline-secure-values-warning',
        'You need to save your access tokens again due to a system update'
      )}
      severity="error"
    />
  );
}
