// @todo: replace barrel import path
import { NotifierDTO } from '../../../../../../types/index';

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
