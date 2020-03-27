import React, { useCallback } from 'react';
import {
  ConfigOverrideRule,
  DataFrame,
  DynamicConfigValue,
  FieldConfigEditorRegistry,
  standardFieldConfigEditorRegistry,
  VariableSuggestionsScope,
  SelectableValue,
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
  customPropertiesRegistry?: FieldConfigEditorRegistry;
  configPropertiesOptions: Array<SelectableValue<string>>;
}

export const OverrideEditor: React.FC<OverrideEditorProps> = ({
  data,
  override,
  onChange,
  onRemove,
  customPropertiesRegistry,
  configPropertiesOptions,
}) => {
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
    (prop: string, custom?: boolean) => {
      const propertyConfig: DynamicConfigValue = {
        prop,
        custom,
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
          const reg = p.custom ? customPropertiesRegistry : standardFieldConfigEditorRegistry;
          const item = reg?.getIfExists(p.prop);

          if (!item) {
            return <div>Unknown property: {p.prop}</div>;
          }

          return (
            <div key={`${p.prop}/${j}`}>
              <DynamicConfigValueEditor
                onChange={value => onDynamicConfigValueChange(j, value)}
                onRemove={() => onDynamicConfigValueRemove(j)}
                property={p}
                editorsRegistry={reg}
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
            icon="plus"
            options={configPropertiesOptions}
            variant={'link'}
            onChange={o => {
              onDynamicConfigValueAdd(o.value, o.custom);
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
