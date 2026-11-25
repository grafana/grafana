import { t } from '@grafana/i18n';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { useRecordingRulesNav } from '../../navigation/useAlertRulesNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { DeletedRulesView } from '../deleted-rules/DeletedRulesView';
import { useRestoreRecordingRule } from '../deleted-rules/useRestoreRecordingRule';

import { useDeletedRecordingRules } from './useDeletedRecordingRules';

function RecordingRulesDeletedPage() {
  const { navId, pageNav } = useRecordingRulesNav();
  const list = useDeletedRecordingRules();
  const restorer = useRestoreRecordingRule();

  return (
    <AlertingPageWrapper navId={navId} pageNav={pageNav}>
      <DeletedRulesView
        kind="recording"
        list={list}
        restorer={restorer}
        restoreTitle={t('alerting.recently-deleted.restore.recording-title', 'Restore recording rule')}
      />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(RecordingRulesDeletedPage);
