import { type ReactElement } from 'react';

import { type NotifierDTO } from 'app/features/alerting/unified/types/alerting';

interface NotifierMetadata {
  enabled: boolean;
  order: number;
  description?: string;
  badge?: ReactElement;
}

export interface Notifier {
  dto: NotifierDTO;
  meta?: NotifierMetadata;
}
