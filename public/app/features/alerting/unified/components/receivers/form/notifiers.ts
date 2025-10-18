import { ReactElement } from 'react';

import { NotifierDTO } from 'app/features/alerting/unified/types/alerting';

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
