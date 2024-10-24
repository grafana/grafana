import {Modal} from "@grafana/ui";
import {NewFolderForm} from "../../../features/browse-dashboards/components/NewFolderForm";
import {useNewFolderMutation} from "../../../features/browse-dashboards/api/browseDashboardsAPI";

export const FolderCreationModal = ({ onDismissModal, ...props }) => {
  const [newFolder] = useNewFolderMutation();
  const onCreateNewFolder = async (folderName: string) => {
    try {
      await newFolder({
        title: folderName,
      });
    } finally {

    }
    // todo: catch error or close modal in finally?
  };

    return (
      <Modal isOpen={true} title="New Folder" {...props}>
        <div>Create a new folder to store your restored dashboard</div>
        <NewFolderForm onConfirm={onCreateNewFolder} onCancel={onDismissModal}/>
      </Modal>
    );
  };
