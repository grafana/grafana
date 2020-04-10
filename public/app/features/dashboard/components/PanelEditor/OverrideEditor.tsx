import React, { useCallback } from 'react';
import {
  ConfigOverrideRule,
  DataFrame,
  DynamicConfigValue,
  FieldConfigOptionsRegistry,
  VariableSuggestionsScope,
  GrafanaTheme,
} from '@grafana/data';
import { fieldMatchersUI, stylesFactory, useTheme, ValuePicker, selectThemeVariant } from '@grafana/ui';
import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';

import { getDataLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { css } from 'emotion';
import { FieldConfigItemHeaderTitle } from '@grafana/ui/src/components/FieldConfigs/FieldConfigItemHeaderTitle';

interface OverrideEditorProps {
  data: DataFrame[];
  override: ConfigOverrideRule;
  onChange: (config: ConfigOverrideRule) => void;
  onRemove: () => void;
  registry: FieldConfigOptionsRegistry;
}

export const OverrideEditor: React.FC<OverrideEditorProps> = ({ data, override, onChange, onRemove, registry }) => {
  const theme = useTheme();
  const onMatcherConfigChange = useCallback(
    (matcherConfig: any) => {
      override.matcher.options = matcherConfig;
      onChange(override);
    },
    [override, onChange]
  );

  const onDynamicConfigValueChange = useCallback(
    (index: number, value: DynamicConfigValue) => {
      override.properties[index].value = value;
      onChange(override);
    },
    [override, onChange]
  );

  const onDynamicConfigValueRemove = useCallback(
    (index: number) => {
      override.properties.splice(index, 1);
      onChange(override);
    },
    [override, onChange]
  );

  const onDynamicConfigValueAdd = useCallback(
    (id: string) => {
      const propertyConfig: DynamicConfigValue = {
        id,
      };
      if (override.properties) {
        override.properties.push(propertyConfig);
      } else {
        override.properties = [propertyConfig];
      }
      onChange(override);
    },
    [override, onChange]
  );

  let configPropertiesOptions = registry.list().map(item => {
    return {
      label: item.name,
      value: item.id,
      description: item.description,
    };
  });

  const matcherUi = fieldMatchersUI.get(override.matcher.id);
  const styles = getStyles(theme);
  return (
    <div className={styles.wrapper}>
      <FieldConfigItemHeaderTitle onRemove={onRemove} title={matcherUi.name} description={matcherUi.description}>
        <div className={styles.matcherUi}>
          <matcherUi.component
            matcher={matcherUi.matcher}
            data={data}
            options={override.matcher.options}
            onChange={option => onMatcherConfigChange(option)}
          />
        </div>
      </FieldConfigItemHeaderTitle>
      <div>
        {override.properties.map((p, j) => {
          const item = registry.getIfExists(p.id);

          if (!item) {
            return <div>Unknown property: {p.id}</div>;
          }

          return (
            <div key={`${p.id}/${j}`}>
              <DynamicConfigValueEditor
                onChange={value => onDynamicConfigValueChange(j, value)}
                onRemove={() => onDynamicConfigValueRemove(j)}
                property={p}
                registry={registry}
                context={{
                  data,
                  getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
                }}
              />
            </div>
          );
        })}
        <div className={styles.propertyPickerWrapper}>
          <ValuePicker
            label="Set config property"
            icon="plus-circle"
            options={configPropertiesOptions}
            variant={'link'}
            onChange={o => {
              onDynamicConfigValueAdd(o.value);
            }}
          />
        </div>
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray85,
      dark: theme.colors.dark9,
    },
    theme.type
  );

  const shadow = selectThemeVariant(
    {
      light: theme.colors.gray85,
      dark: theme.colors.black,
    },
    theme.type
  );

  return {
    wrapper: css`
      border: 1px dashed ${borderColor};
      margin-bottom: ${theme.spacing.md};
      transition: box-shadow 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      box-shadow: none;
      &:hover {
        box-shadow: 0 0 10px ${shadow};
      }
    `,
    matcherUi: css`
      padding: ${theme.spacing.sm};
    `,
    propertyPickerWrapper: css`
      border-top: 1px solid ${borderColor};
    `,
  };
});
