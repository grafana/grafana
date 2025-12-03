import { useCallback, useState } from 'react';

import { Checkbox, ConfirmModal } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { splitClose } from '../../explore/state/main';
import { removeFrame } from '../state/crdtSlice';
import { selectPanelsInFrame, selectPanels } from '../state/selectors';

interface ConfirmDeleteFrameDialogProps {
  frameId: string;
  frameTitle: string;
  panelCount: number;
  onClose: () => void;
}

export function ConfirmDeleteFrameDialog({ frameId, frameTitle, panelCount, onClose }: ConfirmDeleteFrameDialogProps) {
  const dispatch = useDispatch();
  const panelsInFrame = useSelector((state) => selectPanelsInFrame(state.exploreMapCRDT, frameId));
  const allPanels = useSelector((state) => selectPanels(state.exploreMapCRDT));
  const [deletePanels, setDeletePanels] = useState(false);

  const handleConfirm = useCallback(() => {
    // If deleting panels, clean up Explore state first
    if (deletePanels) {
      for (const panelId of panelsInFrame) {
        const panel = allPanels[panelId];
        if (panel) {
          dispatch(splitClose(panel.exploreId));
        }
      }
    }

    dispatch(
      removeFrame({
        frameId,
        deletePanels,
      })
    );
    onClose();
  }, [dispatch, frameId, deletePanels, onClose, panelsInFrame, allPanels]);

  return (
    <ConfirmModal
      isOpen={true}
      title="Delete frame"
      body={
        <div>
          <p>
            Are you sure you want to delete the frame &quot;{frameTitle}&quot;?
          </p>
          {panelCount > 0 && (
            <>
              <p>
                This frame contains {panelCount} panel{panelCount > 1 ? 's' : ''}.
              </p>
              <Checkbox
                label="Also delete all panels in this frame"
                value={deletePanels}
                onChange={(e) => setDeletePanels(e.currentTarget.checked)}
              />
            </>
          )}
        </div>
      }
      confirmText="Delete"
      onConfirm={handleConfirm}
      onDismiss={onClose}
    />
  );
}
