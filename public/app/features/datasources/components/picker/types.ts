import React from 'react';
import { Observable } from 'rxjs';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery, DataSourceJsonData, DataSourceRef } from '@grafana/schema';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';

export interface DataSourceDropdownProps {
  onChange: (ds: DataSourceInstanceSettings<DataSourceJsonData>) => void;
  current: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
  recentlyUsed?: string[];
  queriesChanged?: (queries: GrafanaQuery[] | DataQuery[]) => void;
  runQueries?: () => void;
}

export interface PickerContentProps extends DataSourceDropdownProps {
  onClickAddCSV?: () => void;
  keyboardEvents: Observable<React.KeyboardEvent>;
  style: React.CSSProperties;
  filterTerm?: string;
  onClose: () => void;
  onDismiss: () => void;
}
