import React from 'react';
import { DataSourcePlugin, DataSourcePluginOptionsEditorProps, Input, DataSourceSettings } from '@grafana/ui';
import { TestDataDatasource } from './datasource';
import { TestDataQueryCtrl } from './query_ctrl';

class TestDataAnnotationsQueryCtrl {
  annotation: any;
  constructor() {}
  static template = '<h2>Annotation scenario</h2>';
}

interface TestDataOptions extends DataSourceSettings {
  secondaryNameTest: string;
}

const TestDataOptionsEditor: React.FunctionComponent<DataSourcePluginOptionsEditorProps<TestDataOptions>> = ({
  options,
  onOptionsChange,
}) => {
  return (
    <Input
      value={options.name}
      onChange={event => {
        onOptionsChange({ ...options, name: event.currentTarget.value });
      }}
    />
  );
};

export const plugin = new DataSourcePlugin<TestDataOptions>(TestDataDatasource)
  .setQueryCtrl(TestDataQueryCtrl)
  .setAnnotationQueryCtrl(TestDataAnnotationsQueryCtrl)
  .setEditor(TestDataOptionsEditor);
