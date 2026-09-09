import { useState } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { type RecoverToNewBranch } from '../../types';

interface BranchGoneBannerProps {
  dashboard: DashboardScene;
  /** uid of the version saved on the configured branch, if the dashboard exists there. */
  existingUid?: string;
  /** Set while the scene still holds the deleted branch's content; undefined once the loader fell back to the saved version. */
  draft?: RecoverToNewBranch;
}

/**
 * Shown when the branch a provisioned preview was loaded from has been deleted. With a draft it offers
 * to commit it to a fresh branch or discard it; otherwise it just explains why the saved version is shown.
 */
export function BranchGoneBanner({ dashboard, existingUid, draft }: BranchGoneBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const title = t('dashboard-scene.dashboard-preview-banner.branch-gone-title', 'This branch no longer exists');

  if (!draft) {
    return (
      <Alert severity="info" style={{ flex: 0 }} title={title} onRemove={() => setDismissed(true)}>
        {t(
          'dashboard-scene.dashboard-preview-banner.branch-gone-refresh-body',
          'The branch this preview was created on has been deleted. You are now viewing the saved version of this dashboard.'
        )}
      </Alert>
    );
  }

  const saveToNewBranch = () => {
    // Re-entering edit mode would re-snapshot the baseline and clear isDirty.
    if (!dashboard.state.isEditing) {
      dashboard.onEnterEditMode();
    }
    dashboard.openSaveDrawer({ recoverToNewBranch: draft });
  };

  const discardChanges = () => {
    // Clear the dirty state first, or DashboardPrompt blocks the navigation with its own modal.
    if (dashboard.state.isEditing) {
      dashboard.exitEditMode({ skipConfirm: true, restoreInitialState: true });
    }
    navigate(existingUid ? `/d/${existingUid}` : '/dashboards');
  };

  return (
    <Alert
      severity="warning"
      style={{ flex: 0 }}
      title={title}
      action={
        <Stack alignItems="center" wrap="wrap">
          <Button variant="secondary" fill="outline" onClick={discardChanges}>
            {t('dashboard-scene.dashboard-preview-banner.branch-gone-discard', 'Discard changes')}
          </Button>
          <Button variant="primary" onClick={saveToNewBranch}>
            {t('dashboard-scene.dashboard-preview-banner.branch-gone-save', 'Save to a new branch')}
          </Button>
        </Stack>
      }
    >
      {t(
        'dashboard-scene.dashboard-preview-banner.branch-gone-body',
        'The branch this preview was created on has been deleted, so the pull request can no longer be opened. Your changes only exist in this preview — save them to a new branch to keep them, or discard them and return to the saved version.'
      )}
    </Alert>
  );
}
