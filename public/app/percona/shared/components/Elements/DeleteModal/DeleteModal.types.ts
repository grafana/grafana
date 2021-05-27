export interface DeleteModalProps {
  title?: string;
  message?: string;
  confirm?: string;
  cancel?: string;
  isVisible: boolean;
  loading?: boolean;
  showForce?: boolean;
  forceLabel?: string;
  initialForceValue?: boolean;
  cancelButtonDataQa?: string;
  confirmButtonDataQa?: string;
  setVisible: (value: boolean) => void;
  onDelete: (force?: boolean) => void;
}

export interface DeleteModalFormProps {
  force: boolean;
}
