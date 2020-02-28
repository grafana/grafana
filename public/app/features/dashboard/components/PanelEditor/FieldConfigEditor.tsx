import React from 'react';
import cloneDeep from 'lodash/cloneDeep';
import {
  FieldConfigSource,
  DataFrame,
  FieldPropertyEditorItem,
  VariableSuggestionsScope,
  standardFieldConfigEditorRegistry,
  PanelPlugin,
  SelectableValue,
} from '@grafana/data';
import { Forms, fieldMatchersUI, ValuePicker } from '@grafana/ui';
import { getDataLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { OptionsGroup } from './OptionsGroup';
import { OverrideEditor } from './OverrideEditor';

interface Props {
  plugin: PanelPlugin;
  config: FieldConfigSource;
  include?: string[]; // Ordered list of which fields should be shown/included
  onChange: (config: FieldConfigSource) => void;
  /* Helpful for IntelliSense */
  data: DataFrame[];
}

/**
 * Expects the container div to have size set and will fill it 100%
 */
export class FieldConfigEditor extends React.PureComponent<Props> {
  private setDefaultValue = (name: string, value: any, custom: boolean) => {
    const defaults = { ...this.props.config.defaults };
    const remove = value === undefined || value === null || '';

    if (custom) {
      if (defaults.custom) {
        if (remove) {
          defaults.custom = { ...defaults.custom };
          delete defaults.custom[name];
        } else {
          defaults.custom = { ...defaults.custom, [name]: value };
        }
      } else if (!remove) {
        defaults.custom = { [name]: value };
      }
    } else if (remove) {
      delete (defaults as any)[name];
    } else {
      (defaults as any)[name] = value;
    }

    this.props.onChange({
      ...this.props.config,
      defaults,
    });
  };

  onOverrideChange = (index: number, override: any) => {
    const { config } = this.props;
    let overrides = cloneDeep(config.overrides);
    overrides[index] = override;
    this.props.onChange({ ...config, overrides });
  };

  onOverrideRemove = (overrideIndex: number) => {
    const { config } = this.props;
    let overrides = cloneDeep(config.overrides);
    overrides.splice(overrideIndex, 1);
    this.props.onChange({ ...config, overrides });
  };

  onOverrideAdd = (value: SelectableValue<string>) => {
    const { onChange, config } = this.props;
    onChange({
      ...config,
      overrides: [
        ...config.overrides,
        {
          matcher: {
            id: value.value!,
          },
          properties: [],
        },
      ],
    });
  };

  renderEditor(item: FieldPropertyEditorItem, custom: boolean) {
    const { data } = this.props;
    const config = this.props.config.defaults;
    const value = custom ? (config.custom ? config.custom[item.id] : undefined) : (config as any)[item.id];

    return (
      <Forms.Field label={item.name} description={item.description} key={`${item.id}/${custom}`}>
        <item.editor
          item={item}
          value={value}
          onChange={v => this.setDefaultValue(item.id, v, custom)}
          context={{
            data,
            getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
          }}
        />
      </Forms.Field>
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
    const { plugin } = this.props;

    if (!plugin.customFieldConfigs) {
      return null;
    }

    return plugin.customFieldConfigs.list().map(f => this.renderEditor(f, true));
  }

  renderOverrides() {
    const { config, data, plugin } = this.props;
    const { customFieldConfigs } = plugin;

    if (config.overrides.length === 0) {
      return null;
    }

    let configPropertiesOptions = standardFieldConfigEditorRegistry.list().map(i => ({
      label: i.name,
      value: i.id,
      description: i.description,
      custom: false,
    }));

    if (customFieldConfigs) {
      configPropertiesOptions = configPropertiesOptions.concat(
        customFieldConfigs.list().map(i => ({
          label: i.name,
          value: i.id,
          description: i.description,
          custom: true,
        }))
      );
    }

    return (
      <div>
        {config.overrides.map((o, i) => {
          // TODO:  apply matcher to retrieve fields
          return (
            <OverrideEditor
              key={`${o.matcher.id}/${i}`}
              data={data}
              override={o}
              onChange={value => this.onOverrideChange(i, value)}
              onRemove={() => this.onOverrideRemove(i)}
              configPropertiesOptions={configPropertiesOptions}
              customPropertiesRegistry={customFieldConfigs}
            />
          );
        })}
      </div>
    );
  }

  renderAddOverride = () => {
    return (
      <ValuePicker
        icon="plus"
        label="Add override"
        options={fieldMatchersUI
          .list()
          .map<SelectableValue<string>>(i => ({ label: i.name, value: i.id, description: i.description }))}
        onChange={value => this.onOverrideAdd(value)}
      />
    );
  };

  render() {
    const { plugin } = this.props;

    return (
      <div>
        {plugin.customFieldConfigs && (
          <OptionsGroup title={`${plugin.meta.name} options`}>{this.renderCustomConfigs()}</OptionsGroup>
        )}

        <OptionsGroup title="Field defaults">{this.renderStandardConfigs()}</OptionsGroup>

        <OptionsGroup title="Field overrides">
          {this.renderOverrides()}
          {this.renderAddOverride()}
        </OptionsGroup>
      </div>
    );
  }
}

export default FieldConfigEditor;
