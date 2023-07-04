import { NotifierDTO } from '../../../../../../types';

export interface NotifierMetadata {
  enabled: boolean;
  order: number;
  description?: string;
  iconUrl?: string;
}

export interface Notifier {
  dto: NotifierDTO;
  meta?: NotifierMetadata;
}
