// Libraries
import { memo } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';

type Props = DataSourcePluginOptionsEditorProps;

/**
 * Empty Config Editor -- settings to save
 */
export const ConfigEditor = memo<Props>(() => {
  return <div />;
});

ConfigEditor.displayName = 'ConfigEditor';
