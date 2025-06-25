import { ReactElement } from 'react';

import { NotifierDTO } from '../../../../../../types';

export interface NotifierMetadata {
  enabled: boolean;
  order: number;
  description?: string;
  badge?: ReactElement;
}

export interface Notifier {
  dto: NotifierDTO;
  meta?: NotifierMetadata;
}
