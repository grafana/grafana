import { ReactNode } from 'react';
import { DropzoneOptions } from 'react-dropzone';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceJsonData, DataSourceRef } from '@grafana/schema';

export interface DataSourceDrawerProps {
  datasources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  onFileDrop?: () => void;
  onChange: (ds: string) => void;
  current: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
  children?: JSX.Element | ReactNode;
  fileUploadOptions?: DropzoneOptions;
  recentlyUsed?: string[];
}

export interface DataSourceCardProps {
  onChange: (uid: string) => void;
  ds: DataSourceInstanceSettings<DataSourceJsonData>;
}

export interface PickerContentProps extends DataSourceDrawerProps {
  onDismiss: () => void;
}
