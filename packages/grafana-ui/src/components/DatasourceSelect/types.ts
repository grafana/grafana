import { ReactNode } from 'react';
import { DropzoneOptions } from 'react-dropzone';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceJsonData, DataSourceRef } from '@grafana/schema';

export interface DatasourceSelectProps {
  datasources: Array<DataSourceInstanceSettings<DataSourceJsonData>>;
  onFileDrop?: () => void;
  onChange: (ds: string) => void;
  current: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
  children?: JSX.Element | ReactNode;
  fileUploadOptions?: DropzoneOptions;
}

export interface DatasourceDrawerProps extends DatasourceSelectProps {
  onDismiss: () => void;
}
