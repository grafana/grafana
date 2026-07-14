import { lazy, Suspense, useState } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { type ToolbarActionProps } from '../types';

export const ImproveDashboardModal = lazy(() =>
  import('app/features/dashboard-wizard/ImproveDashboardModal').then((module) => ({
    default: module.ImproveDashboardModal,
  }))
);

/**
 * Opens the "Improve this dashboard" assistant flow: the user describes the
 * changes and the assistant's dashboarding agent applies them headlessly to
 * the open dashboard, leaving the result unsaved for review.
 */
export const ImproveDashboardButton = ({ dashboard }: ToolbarActionProps) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <ToolbarButton
        icon="ai-sparkle"
        variant="canvas"
        tooltip={t(
          'dashboard.toolbar.new.improve-dashboard-tooltip',
          'Let the Grafana Assistant improve this dashboard'
        )}
        onClick={() => setShowModal(true)}
        data-testid="improve-dashboard-button"
      />
      {showModal && (
        <Suspense fallback={null}>
          <ImproveDashboardModal dashboard={dashboard} onDismiss={() => setShowModal(false)} />
        </Suspense>
      )}
    </>
  );
};
