import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

interface Props {
  repo?: Repository;
  items?: Repository[];
}

// TODO: remove this after 12.2
export function InlineSecureValueWarning({ repo, items }: Props) {
  if (repo?.spec?.type === 'local' || repo?.secure?.token?.name) {
    return null;
  }

  // When a list is passed in, show an error if anything is missing
  if (items) {
    let ok = true;
    for (const r of items) {
      if (r.spec?.type !== 'local' && !r.secure?.token?.name) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return null; // all items in the
    }
  }

  return (
    <Alert
      title={t('provisioning.inline-secure-values-warning-title', 'Access tokens need to be saved again')}
      severity="warning"
    >
      <Trans i18nKey="provisioning.inline-secure-values-warning-body">
        The method to save secure values has changed. This requires re-saving all secrets.
      </Trans>
    </Alert>
  );
}
