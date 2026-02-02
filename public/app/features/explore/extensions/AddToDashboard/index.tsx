import { useCallback, useEffect, useRef, useState } from 'react';

import { Modal, ToolbarButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useSelector } from 'app/types';

import { getExploreItemSelector } from '../../state/selectors';

import { ExploreToDashboardPanel } from './ExploreToDashboardPanel';
import { getAddToDashboardTitle } from './getAddToDashboardTitle';

interface Props {
  exploreId: string;
}

export const AddToDashboard = ({ exploreId }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  //BMC Accessibility change : Next 2 lines
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const isFirstRender = useRef(true); // To track the first render
  const selectExploreItem = getExploreItemSelector(exploreId);
  const explorePaneHasQueries = !!useSelector(selectExploreItem)?.queries?.length;
  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  //BMC Accessibility Change.
  useEffect(() => {
    if (!isOpen && !isFirstRender.current && openButtonRef.current) {
      openButtonRef.current.focus();
    }
    isFirstRender.current = false; // Set to false after the first render
  }, [isOpen]);
  //BMC change ends here.
  const addToDashboardLabel = t('explore.add-to-dashboard', 'Add to dashboard');

  return (
    <>
      <ToolbarButton
        icon="apps"
        variant="canvas"
        onClick={() => setIsOpen(true)}
        aria-label={addToDashboardLabel}
        disabled={!explorePaneHasQueries}
        //BMC Accessibility Change : Next line.
        ref={openButtonRef}
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
