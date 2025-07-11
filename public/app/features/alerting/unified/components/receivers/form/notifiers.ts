import { ReactElement } from 'react';

import { NotifierDTO } from 'app/types/alerting';

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
