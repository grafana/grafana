import { useCallback, useEffect, useRef, useState } from 'react';

import { t } from '@grafana/i18n';
import { onInteraction, reportInteraction } from '@grafana/runtime';
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
  const didSubmitRef = useRef(false);
  const selectExploreItem = getExploreItemSelector(exploreId);
  const explorePaneHasQueries = !!useSelector(selectExploreItem)?.queries?.length;

  // Track whether the form was submitted so we can distinguish
  // close-after-submit from close-without-submit (discard).
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    didSubmitRef.current = false;
    return onInteraction('e_2_d_submit', () => {
      didSubmitRef.current = true;
    });
  }, [isOpen]);

  const onClose = useCallback(() => {
    if (!didSubmitRef.current) {
      reportInteraction('e_2_d_discarded', {}, { silent: true });
    }
    setIsOpen(false);
  }, []);

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
