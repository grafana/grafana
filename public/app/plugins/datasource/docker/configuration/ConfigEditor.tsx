import { 
  type DataSourcePluginOptionsEditorProps,
} from '@grafana/data';
import {ConnectionSettings, Auth, convertLegacyAuthProps, AuthMethod} from '@grafana/plugin-ui';
import { DockerOptions } from '../types';

export const ConfigEditor = (props: DataSourcePluginOptionsEditorProps<DockerOptions>) => {
  const { options, onOptionsChange } = props;
  const newAuthProps = convertLegacyAuthProps({
    config: props.options,
    onChange: onOptionsChange
  });

  return (
    <>
      <ConnectionSettings
        config={options}
        onChange={onOptionsChange}
        urlPlaceholder="http://localhost:2375"
      />
      <Auth
        {...newAuthProps}
        selectedMethod={newAuthProps.selectedMethod}
        onAuthMethodSelect={newAuthProps.onAuthMethodSelect}
        visibleMethods={[AuthMethod.NoAuth]}
      />
    </>
  );
};
