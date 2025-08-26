import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { Modal, ToolbarButton } from '@grafana/ui';
import { useSelector } from 'app/types/store';

import { getExploreItemSelector } from '../../state/selectors';

import { ExploreToDashboardPanel } from './ExploreToDashboardPanel';
import { getAddToDashboardTitle } from './getAddToDashboardTitle';

interface Props {
  exploreId: string;
}

export const AddToDashboard = ({ exploreId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectExploreItem = getExploreItemSelector(exploreId);
  const explorePaneHasQueries = !!useSelector(selectExploreItem)?.queries?.length;
  const onClose = useCallback(() => setIsOpen(false), []);

  const addToDashboardLabel = t('explore.add-to-dashboard', 'Add to dashboard');

  return (
    <>
      <ToolbarButton
        icon="apps"
        variant="canvas"
        onClick={() => setIsOpen(true)}
        aria-label={addToDashboardLabel}
        disabled={!explorePaneHasQueries}
      >
        {addToDashboardLabel}
      </ToolbarButton>

      {isOpen && (
        <Modal title={getAddToDashboardTitle()} onDismiss={onClose} isOpen>
          <ExploreToDashboardPanel onClose={onClose} exploreId={exploreId} />
        </Modal>
      )}
    </>
  );
};
