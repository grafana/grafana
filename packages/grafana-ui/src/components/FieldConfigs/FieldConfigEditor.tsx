import React from 'react';
import {
  FieldConfigEditorRegistry,
  FieldConfigSource,
  DataFrame,
  FieldPropertyEditorItem,
  GrafanaTheme,
} from '@grafana/data';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';
import { stylesFactory } from '../../themes';
import { css } from 'emotion';
import { Themeable } from '../../types';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  fieldEditor: css`
    border: 1px solid red;
  `,
  customEditor: css`
    border: 1px solid green;
  `,
}));

interface Props extends Themeable {
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

    this.styles = getStyles(this.props.theme);
  }

  renderEditor(item: FieldPropertyEditorItem, custom: boolean) {
    const config = this.props.config.defaults;
    const value = custom ? (config.custom ? config.custom[item.id] : undefined) : (config as any)[item.id];

    return (
      <div key={`${item.id}/${custom}`} className={custom ? this.styles.customEditor : this.styles.fieldEditor}>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <item.editor
          theme={this.props.theme}
          item={item}
          value={value}
          onChange={v => {
            console.log('TODO, update item...');
          }}
        />
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
