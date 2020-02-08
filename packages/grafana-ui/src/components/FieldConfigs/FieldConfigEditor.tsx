import React from 'react';
import { FieldConfigEditorRegistry, FieldConfigSource, DataFrame, FieldPropertyEditorItem } from '@grafana/data';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';

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
  styles: any; // ???

  constructor(props: Props) {
    super(props);
  }

  private setDefaultValue = (name: string, value: any, custom: boolean) => {
    const defaults = { ...this.props.config.defaults };
    const remove = value === undefined || value === null;
    if (custom) {
      if (defaults.custom) {
        if (remove) {
          defaults.custom = { ...defaults.custom }; // TODO!!
          delete defaults.custom[name]; // something better???
        } else {
          defaults.custom = { ...defaults.custom, [name]: value };
        }
      } else if (remove) {
        delete (defaults as any)[name];
      } else {
        (defaults as any)[name] = value;
      }
    }
    this.props.onChange({
      ...this.props.config,
      defaults,
    });
  };

  renderEditor(item: FieldPropertyEditorItem, custom: boolean) {
    const config = this.props.config.defaults;
    const value = custom ? (config.custom ? config.custom[item.id] : undefined) : (config as any)[item.id];

    return (
      <div key={`${item.id}/${custom}`}>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <item.editor item={item} value={value} onChange={v => this.setDefaultValue(item.name, v, custom)} />
      </div>
    );
  }

  renderStandardConfigs() {
    const { include } = this.props;
    if (include) {
      return include.map(f => this.renderEditor(standardFieldConfigEditorRegistry.get(f), false));
    }
    return standardFieldConfigEditorRegistry.list().map(f => this.renderEditor(f, false));
  }

  renderCustomConfigs() {
    const { custom } = this.props;
    if (!custom) {
      return null;
    }
    return custom.list().map(f => this.renderEditor(f, true));
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
