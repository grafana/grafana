import { MouseEventHandler } from 'react';

export interface LastCheckProps<T = HTMLButtonElement> {
  lastCheckDate: string;
  onCheckForUpdates: MouseEventHandler<T>;
  disabled?: boolean;
}
