import { DateTime } from '@grafana/data';
import { DataSourcePickerProps } from '@grafana/runtime';

export interface DataSourcePickerWithHistoryProps extends Omit<DataSourcePickerProps, 'recentlyUsed'> {
  key?: string;
}

export interface DataSourcePickerHistoryItem {
  lastUse: string;
  uid: string;
}
