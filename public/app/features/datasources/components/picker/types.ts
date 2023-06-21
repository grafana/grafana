import React from 'react';
import { Observable } from 'rxjs';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery, DataSourceJsonData, DataSourceRef } from '@grafana/schema';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';

export interface DataSourceDropdownProps {
  onChange: (ds: DataSourceInstanceSettings<DataSourceJsonData>, defaultQueries?: DataQuery[] | GrafanaQuery[]) => void;
  current: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  logs?: boolean;
  recentlyUsed?: string[];
  hideTextValue?: boolean;
  width?: number;
}

export interface PickerContentProps extends DataSourceDropdownProps {
  onClickAddCSV?: () => void;
  keyboardEvents: Observable<React.KeyboardEvent>;
  style: React.CSSProperties;
  filterTerm?: string;
  dashboard?: boolean;
  mixed?: boolean;
  onClose: () => void;
  onDismiss: () => void;
}
