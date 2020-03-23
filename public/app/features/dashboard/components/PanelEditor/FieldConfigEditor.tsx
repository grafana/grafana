import React, { useCallback } from 'react';
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
import { Forms, fieldMatchersUI, ValuePicker, useTheme } from '@grafana/ui';
import { getDataLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { OverrideEditor } from './OverrideEditor';
import { css } from 'emotion';

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
export const OverrideFieldConfigEditor: React.FC<Props> = props => {
  const theme = useTheme();

  const onOverrideChange = (index: number, override: any) => {
    const { config } = props;
    let overrides = cloneDeep(config.overrides);
    overrides[index] = override;
    props.onChange({ ...config, overrides });
  };

  const onOverrideRemove = (overrideIndex: number) => {
    const { config } = props;
    let overrides = cloneDeep(config.overrides);
    overrides.splice(overrideIndex, 1);
    props.onChange({ ...config, overrides });
  };

  const onOverrideAdd = (value: SelectableValue<string>) => {
    const { onChange, config } = props;
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

  const renderOverrides = () => {
    const { config, data, plugin } = props;
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
              onChange={value => onOverrideChange(i, value)}
              onRemove={() => onOverrideRemove(i)}
              configPropertiesOptions={configPropertiesOptions}
              customPropertiesRegistry={customFieldConfigs}
            />
          );
        })}
      </div>
    );
  };

  const renderAddOverride = () => {
    return (
      <ValuePicker
        icon="plus"
        label="Add override"
        options={fieldMatchersUI
          .list()
          .map<SelectableValue<string>>(i => ({ label: i.name, value: i.id, description: i.description }))}
        onChange={value => onOverrideAdd(value)}
      />
    );
  };

  return (
    <div
      className={css`
        padding: ${theme.spacing.md};
      `}
    >
      {renderOverrides()}
      {renderAddOverride()}
    </div>
  );
};

export const DefaultFieldConfigEditor: React.FC<Props> = ({ include, data, onChange, config, plugin }) => {
  const setDefaultValue = useCallback(
    (name: string, value: any, custom: boolean) => {
      const defaults = { ...config.defaults };
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

      onChange({
        ...config,
        defaults,
      });
    },
    [config, onChange]
  );

  const renderEditor = useCallback(
    (item: FieldPropertyEditorItem, custom: boolean) => {
      const defaults = config.defaults;
      const value = custom ? (defaults.custom ? defaults.custom[item.id] : undefined) : (defaults as any)[item.id];

      return (
        <Forms.Field label={item.name} description={item.description} key={`${item.id}/${custom}`}>
          <item.editor
            item={item}
            value={value}
            onChange={v => setDefaultValue(item.id, v, custom)}
            context={{
              data,
              getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
            }}
          />
        </Forms.Field>
      );
    },
    [config]
  );

  const renderStandardConfigs = useCallback(() => {
    if (include) {
      return <>{include.map(f => renderEditor(standardFieldConfigEditorRegistry.get(f), false))}</>;
    }
    return <>{standardFieldConfigEditorRegistry.list().map(f => renderEditor(f, false))}</>;
  }, [plugin, config]);

  const renderCustomConfigs = useCallback(() => {
    if (!plugin.customFieldConfigs) {
      return null;
    }

    return plugin.customFieldConfigs.list().map(f => renderEditor(f, true));
  }, [plugin, config]);

  return (
    <>
      {plugin.customFieldConfigs && renderCustomConfigs()}
      {renderStandardConfigs()}
    </>
  );
};
