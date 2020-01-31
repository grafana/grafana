import React from 'react';
import { FieldConfigEditorRegistry, FieldConfigSource, DataFrame } from '@grafana/data';

interface Props {
  config: FieldConfigSource;
  custom?: FieldConfigEditorRegistry; // custom fields
  include?: string[]; // Ordered list of which fields should be shown/included
  onChange: (config: FieldConfigSource) => void;

  // Helpful for IntelliSense
  data: DataFrame[];
}

interface State {
  //
}

/**
 * Expects the container div to have size set and will fill it 100%
 */
export class FieldConfigEditor extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  renderStandardConfigs() {
    return <div>STANDARD</div>;
  }

  renderCustomConfigs() {
    return <div>CUSTOM</div>;
  }

  renderOverrides() {
    return <div>Override rules</div>;
  }

  renderAddOverride() {
    return <div>Override rules</div>;
  }

  render() {
    return (
      <div>
        {this.renderStandardConfigs()}
        {this.renderCustomConfigs()}
        {this.renderOverrides()}
        {this.renderAddOverride()}
      </div>
    );
  }
}

export default FieldConfigEditor;
