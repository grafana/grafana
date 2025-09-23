import { PropsWithChildren } from 'react';

export interface DeleteModalProps extends PropsWithChildren {
  title?: string;
  message?: string;
  confirm?: string;
  cancel?: string;
  isVisible: boolean;
  loading?: boolean;
  showForce?: boolean;
  forceLabel?: string;
  initialForceValue?: boolean;
  cancelButtondataTestId?: string;
  confirmButtondataTestId?: string;
  setVisible: (value: boolean) => void;
  onDelete: (force?: boolean) => void;
}

export interface DeleteModalFormProps {
  force: boolean;
}
