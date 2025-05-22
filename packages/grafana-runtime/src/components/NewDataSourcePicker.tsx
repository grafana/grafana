import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';

interface NewDataSourcePickerProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null; // uid
  hideTextValue?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  openMenuOnFocus?: boolean;
  placeholder?: string;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  /** If true,we show only DSs with logs; and if true, pluginId shouldnt be passed in */
  logs?: boolean;
  // If set to true and there is no value select will be empty, otherwise it will preselect default data source
  noDefault?: boolean;
  width?: number;
  inputId?: string;
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;
  onClear?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
}

type NewDataSourcePickerComponentType = React.ComponentType<NewDataSourcePickerProps>;

let NewDataSourcePickerComponent: NewDataSourcePickerComponentType | undefined;

/**
 * Used to bootstrap the FolderPicker during application start
 *
 * @internal
 */
export function setNewDataSourcePicker(component: NewDataSourcePickerComponentType) {
  NewDataSourcePickerComponent = component;
}

export function NewDataSourcePicker(props: NewDataSourcePickerProps) {
  if (NewDataSourcePickerComponent) {
    return <NewDataSourcePickerComponent {...props} />;
  }

  if (process.env.NODE_ENV !== 'production') {
    return <div>@grafana/runtime NewDataSourcePicker is not set</div>;
  }

  return null;
}
