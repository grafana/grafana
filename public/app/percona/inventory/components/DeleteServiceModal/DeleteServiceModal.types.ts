export interface DeleteServiceModalProps {
  serviceId: string;
  serviceName: string;
  isOpen: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}
