export interface DeleteModalProps {
  title?: string;
  message?: string;
  confirm?: string;
  cancel?: string;
  isVisible: boolean;
  loading?: boolean;
  setVisible: (value: boolean) => void;
  onDelete: () => void;
}
