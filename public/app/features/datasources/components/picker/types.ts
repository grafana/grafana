import React from 'react';
import { DropzoneOptions } from 'react-dropzone';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceJsonData, DataSourceRef } from '@grafana/schema';

export interface DataSourceDropdownProps {
  onChange: (ds: DataSourceInstanceSettings<DataSourceJsonData>) => void;
  current: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
  enableFileUpload?: boolean;
  fileUploadOptions?: DropzoneOptions;
  onClickAddCSV?: () => void;
  recentlyUsed?: string[];
}

export interface PickerContentProps extends DataSourceDropdownProps {
  style: React.CSSProperties;
  filterTerm?: string;
  onClose: () => void;
  onDismiss: () => void;
}
