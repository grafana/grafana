import { Row } from 'react-table';

import { FlattenService } from '../../Inventory.types';

export interface DeleteServicesModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
  services: Array<Row<FlattenService>>;
}
