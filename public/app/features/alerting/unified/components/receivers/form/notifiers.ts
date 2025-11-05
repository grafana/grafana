import { NotifierDTO } from '../../../../../../types';

export interface NotifierMetadata {
  enabled: boolean;
  order: number;
  description?: string;
  iconUrl?: string;
  badge?: React.ReactNode;
}

export interface Notifier {
  dto: NotifierDTO;
  meta?: NotifierMetadata;
}
