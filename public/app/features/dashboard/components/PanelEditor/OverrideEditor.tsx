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

  const matcherLabel = (
    <Label category={['Matcher']} description={matcherUi.description}>
      {matcherUi.name}
    </Label>
  );

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
    return (
      <div>
        <HorizontalGroup justify="space-between">
          <div>{name}</div>
          <IconButton name="trash-alt" onClick={onRemove} />
        </HorizontalGroup>
        {!isExpanded && (
          <div className={styles.overrideDetails}>
            Matcher <Icon name="angle-right" /> {matcherUi.name} <br />
            {override.properties.length === 0 ? 'No' : override.properties.length} properties overriden
          </div>
        )}
      </div>
    );
  };

  return (
    <OptionsGroup renderTitle={renderOverrideTitle} id={name} key={name}>
      <Field label={matcherLabel} description={matcherUi.description}>
        <matcherUi.component
          matcher={matcherUi.matcher}
          data={data}
          options={override.matcher.options}
          onChange={option => onMatcherConfigChange(option)}
        />
      </Field>

      <div>
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
                onDynamicConfigValueAdd(o.value);
              }}
              isFullWidth={false}
            />
          </div>
        )}
      </div>
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
  };
});
