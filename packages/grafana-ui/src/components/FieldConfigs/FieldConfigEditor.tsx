import React from 'react';
import cloneDeep from 'lodash/cloneDeep';
import {
  FieldConfigEditorRegistry,
  FieldConfigSource,
  DataFrame,
  FieldPropertyEditorItem,
  DynamicConfigValue,
} from '@grafana/data';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';
import Forms from '../Forms';
import { fieldMatchersUI } from '../MatchersUI/fieldMatchersUI';

interface Props {
  config: FieldConfigSource;
  custom?: FieldConfigEditorRegistry; // custom fields
  include?: string[]; // Ordered list of which fields should be shown/included
  onChange: (config: FieldConfigSource) => void;

  // Helpful for IntelliSense
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

  onMatcherConfigChange = (index: number, matcherConfig?: any) => {
    const { config } = this.props;
    let overrides = cloneDeep(config.overrides);
    if (matcherConfig === undefined) {
      overrides = overrides.splice(index, 1);
    } else {
      overrides[index].matcher.options = matcherConfig;
    }
    this.props.onChange({ ...config, overrides });
  };

  onDynamicConfigValueAdd = (index: number, prop: string, custom?: boolean) => {
    const { config } = this.props;
    let overrides = cloneDeep(config.overrides);

    const propertyConfig: DynamicConfigValue = {
      prop,
      custom,
    };
    if (overrides[index].properties) {
      overrides[index].properties.push(propertyConfig);
    } else {
      overrides[index].properties = [propertyConfig];
    }

    this.props.onChange({ ...config, overrides });
  };

  onDynamicConfigValueChange = (overrideIndex: number, propertyIndex: number, value?: any) => {
    const { config } = this.props;
    let overrides = cloneDeep(config.overrides);
    overrides[overrideIndex].properties[propertyIndex].value = value;
    this.props.onChange({ ...config, overrides });
  };

  renderEditor(item: FieldPropertyEditorItem, custom: boolean) {
    const config = this.props.config.defaults;
    const value = custom ? (config.custom ? config.custom[item.id] : undefined) : (config as any)[item.id];

    return (
      <Forms.Field label={item.name} description={item.description} key={`${item.id}/${custom}`}>
        <item.editor item={item} value={value} onChange={v => this.setDefaultValue(item.id, v, custom)} />
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
    const { custom } = this.props;
    if (!custom) {
      return null;
    }
    return custom.list().map(f => this.renderEditor(f, true));
  }

  renderOverrides() {
    const { config, data, custom } = this.props;

    let configPropertiesOptions = standardFieldConfigEditorRegistry.list().map(i => ({
      label: i.name,
      value: i.id,
      description: i.description,
      custom: false,
    }));

    if (custom) {
      configPropertiesOptions = configPropertiesOptions.concat(
        custom.list().map(i => ({
          label: i.name,
          value: i.id,
          description: i.description,
          custom: true,
        }))
      );
    }

    return (
      <>
        {config.overrides.map((o, i) => {
          const matcherUi = fieldMatchersUI.get(o.matcher.id);
          return (
            <div key={`${o.matcher.id}/${i}`}>
              <Forms.Field label={matcherUi.name} description={matcherUi.description}>
                <>
                  <matcherUi.component
                    matcher={matcherUi.matcher}
                    data={data}
                    options={o.matcher.options}
                    onChange={option => this.onMatcherConfigChange(i, option)}
                  />
                  <Forms.ButtonSelect
                    icon="plus"
                    placeholder="Set config property"
                    options={configPropertiesOptions}
                    onChange={o => {
                      this.onDynamicConfigValueAdd(i, o.value!, o.custom);
                    }}
                  />

                  {o.properties.map((p, j) => {
                    const reg = p.custom ? custom : standardFieldConfigEditorRegistry;
                    const item = reg?.get(p.prop);
                    if (!item) {
                      return <div>Unknown property: {p.prop}</div>;
                    }
                    return (
                      <Forms.Field label={item.name} description={item.description}>
                        <item.override
                          value={p.value}
                          onChange={value => {
                            this.onDynamicConfigValueChange(i, j, value);
                          }}
                          item={item}
                          context={{} as any}
                        />
                      </Forms.Field>
                    );
                  })}
                </>
              </Forms.Field>
            </div>
          );
        })}
      </>
    );
  }

  renderAddOverride = () => {
    return (
      <Forms.ButtonSelect
        icon="plus"
        placeholder={'Add override'}
        value={{ label: 'Add override' }}
        options={fieldMatchersUI.list().map(i => ({ label: i.name, value: i.id, description: i.description }))}
        onChange={value => {
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
        }}
      />
    );
  };

  render() {
    return (
      <div>
        {this.renderStandardConfigs()}
        {this.renderCustomConfigs()}
        {this.renderAddOverride()}
        {this.renderOverrides()}
      </div>
    );
  }
}

export default FieldConfigEditor;
