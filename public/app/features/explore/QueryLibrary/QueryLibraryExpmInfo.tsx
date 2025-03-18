import { Alert, Modal } from '@grafana/ui';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
}

export function QueryLibraryExpmInfo({ isOpen, onDismiss }: Props) {
  return (
    <Modal title="Query Library" isOpen={isOpen} onDismiss={onDismiss}>
      <Alert
        severity="info"
        title="Query library is in the experimental mode. It is a place where you can save your queries and share them with
    your team. Once you save a query, it will be available for the whole organization to use."
      />
      <Alert severity="info" title=" Currently we are limiting the number of saved queries per organization to 1000." />
      <Alert
        severity="warning"
        title="Although it's unlikely, some data loss may occur during the experimental phase."
      />
    </Modal>
  );
}
