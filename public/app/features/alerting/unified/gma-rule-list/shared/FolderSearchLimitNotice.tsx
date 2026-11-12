import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { FOLDER_NAME_LOOKUP_LIMIT } from '../rule-search/useRuleSearchApiArgs';

export function FolderSearchLimitNotice() {
  return (
    <Alert
      severity="warning"
      title={t('alerting.gma-rule-list.shared.folder-search-limit', 'Folder search limit reached')}
    >
      <Trans
        i18nKey="alerting.gma-rule-list.shared.folder-search-limit-description"
        values={{ limit: FOLDER_NAME_LOOKUP_LIMIT }}
      >
        Showing results from only the first {'{{limit}}'} matching folders. Narrow your search criteria to see results
        from other folders.
      </Trans>
    </Alert>
  );
}
