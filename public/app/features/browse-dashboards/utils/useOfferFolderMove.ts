import { appEvents } from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import { useMoveFolderMutationFacade } from '../../../api/clients/folder/v1beta1/hooks';
import { MoveModal } from '../components/BrowseActions/MoveModal';

/**
 * Returns a function that opens the existing Move modal for a single folder -- the "way out" for
 * a folder that's stuck mid cascade-delete (e.g. a legacy subfolder blocking it): moving the
 * problem folder elsewhere unblocks the parent's cascade without anyone having to figure out
 * exactly what's wrong first. Shared by DeleteModal's error state and FolderCascadeStatusBanner
 * rather than duplicated, since both need the exact same trigger.
 */
export function useOfferFolderMove() {
  const [moveFolder] = useMoveFolderMutationFacade();

  return (folderUID: string) => {
    appEvents.publish(
      new ShowModalReactEvent({
        component: MoveModal,
        props: {
          selectedItems: { folder: { [folderUID]: true }, dashboard: {}, panel: {}, $all: false },
          onConfirm: async (destinationUID: string) => {
            await moveFolder({ folderUID, destinationUID });
          },
        },
      })
    );
  };
}
