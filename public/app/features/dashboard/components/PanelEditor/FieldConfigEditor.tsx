import React, { useCallback } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import {
  FieldConfigSource,
  DataFrame,
  FieldConfigPropertyItem,
  VariableSuggestionsScope,
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
    const { fieldConfigRegistry } = plugin;

    if (config.overrides.length === 0) {
      return null;
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
              registry={fieldConfigRegistry}
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
        variant="secondary"
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

export const DefaultFieldConfigEditor: React.FC<Props> = ({ data, onChange, config, plugin }) => {
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
    (item: FieldConfigPropertyItem) => {
      if (item.isCustom && item.showIf && !item.showIf(config.defaults.custom)) {
        return null;
      }
      const defaults = config.defaults;
      const value = item.isCustom
        ? defaults.custom
          ? defaults.custom[item.path]
          : undefined
        : (defaults as any)[item.path];

      return (
        <Forms.Field label={item.name} description={item.description} key={`${item.id}`}>
          <item.editor
            item={item}
            value={value}
            onChange={v => setDefaultValue(item.path, v, item.isCustom)}
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

  // render all field configs
  return <>{plugin.fieldConfigRegistry.list().map(renderEditor)}</>;
};
