import React, { useCallback } from 'react';
import {
  ConfigOverrideRule,
  DataFrame,
  DynamicConfigValue,
  FieldConfigOptionsRegistry,
  FieldConfigProperty,
  GrafanaTheme,
  VariableSuggestionsScope,
} from '@grafana/data';
import {
  Field,
  fieldMatchersUI,
  HorizontalGroup,
  Icon,
  IconButton,
  Label,
  stylesFactory,
  useTheme,
  ValuePicker,
} from '@grafana/ui';
import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';

import { getDataLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { css } from 'emotion';
import { OptionsGroup } from './OptionsGroup';

interface OverrideEditorProps {
  name: string;
  data: DataFrame[];
  override: ConfigOverrideRule;
  onChange: (config: ConfigOverrideRule) => void;
  onRemove: () => void;
  registry: FieldConfigOptionsRegistry;
}

const COLLECTION_STANDARD_PROPERTIES = [
  FieldConfigProperty.Thresholds,
  FieldConfigProperty.Links,
  FieldConfigProperty.Mappings,
];

export const OverrideEditor: React.FC<OverrideEditorProps> = ({
  name,
  data,
  override,
  onChange,
  onRemove,
  registry,
}) => {
  const theme = useTheme();
  const matcherUi = fieldMatchersUI.get(override.matcher.id);
  const styles = getStyles(theme);

  const matcherLabel = <Label>{matcherUi.name}</Label>;

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
      const registryItem = registry.get(id);
      const propertyConfig: DynamicConfigValue = {
        id,
        value: registryItem.defaultValue,
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

  const renderOverrideTitle = (isExpanded: boolean) => {
    const overriddenProperites = override.properties.map(p => registry.get(p.id).name).join(', ');
    const matcherOptions = matcherUi.optionsToLabel(override.matcher.options);
    return (
      <div>
        <HorizontalGroup justify="space-between">
          <div>{name}</div>
          <IconButton name="trash-alt" onClick={onRemove} />
        </HorizontalGroup>
        {!isExpanded && (
          <div className={styles.overrideDetails}>
            <div className={styles.options} title={matcherOptions}>
              {matcherUi.name} <Icon name="angle-right" /> {matcherOptions}
            </div>
            <div className={styles.options} title={overriddenProperites}>
              Properties overridden <Icon name="angle-right" />
              {overriddenProperites}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <OptionsGroup renderTitle={renderOverrideTitle} id={name} key={name}>
      <Field label={matcherLabel}>
        <matcherUi.component
          matcher={matcherUi.matcher}
          data={data}
          options={override.matcher.options}
          onChange={option => onMatcherConfigChange(option)}
        />
      </Field>

      <>
        {override.properties.map((p, j) => {
          const item = registry.getIfExists(p.id);

          if (!item) {
            return <div>Unknown property: {p.id}</div>;
          }
          const isCollapsible =
            Array.isArray(p.value) || COLLECTION_STANDARD_PROPERTIES.includes(p.id as FieldConfigProperty);

          return (
            <DynamicConfigValueEditor
              key={`${p.id}/${j}`}
              isCollapsible={isCollapsible}
              onChange={value => onDynamicConfigValueChange(j, value)}
              onRemove={() => onDynamicConfigValueRemove(j)}
              property={p}
              registry={registry}
              context={{
                data,
                getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
              }}
            />
          );
        })}
        {override.matcher.options && (
          <div className={styles.propertyPickerWrapper}>
            <ValuePicker
              label="Add override property"
              variant="secondary"
              icon="plus"
              options={configPropertiesOptions}
              onChange={o => {
                onDynamicConfigValueAdd(o.value!);
              }}
              isFullWidth={false}
            />
          </div>
        )}
      </>
    </OptionsGroup>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    matcherUi: css`
      padding: ${theme.spacing.sm};
    `,
    propertyPickerWrapper: css`
      margin-top: ${theme.spacing.formSpacingBase * 2}px;
    `,
    overrideDetails: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      font-weight: ${theme.typography.weight.regular};
    `,
    options: css`
      overflow: hidden;
      padding-right: ${theme.spacing.xl};
    `,
  };
});
