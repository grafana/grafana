import {
  DynamicConfigValue,
  FieldConfigOptionsRegistry,
  FieldConfigProperty,
  FieldOverrideContext,
  GrafanaTheme,
} from '@grafana/data';
import React from 'react';
import { Counter, Field, HorizontalGroup, IconButton, Label, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { OptionsPaneCategory } from './OptionsPaneCategory';

interface DynamicConfigValueEditorProps {
  property: DynamicConfigValue;
  registry: FieldConfigOptionsRegistry;
  onChange: (value: DynamicConfigValue) => void;
  context: FieldOverrideContext;
  onRemove: () => void;
  isSystemOverride?: boolean;
}

export const DynamicConfigValueEditor: React.FC<DynamicConfigValueEditorProps> = ({
  property,
  context,
  registry,
  onChange,
  onRemove,
  isSystemOverride,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const item = registry?.getIfExists(property.id);

  if (!item) {
    return null;
  }

  const isCollapsible =
    Array.isArray(property.value) ||
    property.id === FieldConfigProperty.Thresholds ||
    property.id === FieldConfigProperty.Links ||
    property.id === FieldConfigProperty.Mappings;

  const labelCategory = item.category?.filter((c) => c !== item.name);
  let editor;

  // eslint-disable-next-line react/display-name
  const renderLabel = (includeDescription = true, includeCounter = false) => (isExpanded = false) => (
    <HorizontalGroup justify="space-between">
      <Label category={labelCategory} description={includeDescription ? item.description : undefined}>
        {item.name}
        {!isExpanded && includeCounter && item.getItemsCount && <Counter value={item.getItemsCount(property.value)} />}
      </Label>
      {!isSystemOverride && (
        <div>
          <IconButton name="times" onClick={onRemove} />
        </div>
      )}
    </HorizontalGroup>
  );

  if (isCollapsible) {
    editor = (
      <OptionsPaneCategory
        id={item.name}
        renderTitle={renderLabel(false, true)}
        className={css`
          padding-left: 0;
          padding-right: 0;
        `}
        isNested
        isOpenDefault={property.value !== undefined}
      >
        <item.override
          value={property.value}
          onChange={(value) => {
            onChange(value);
          }}
          item={item}
          context={context}
        />
      </OptionsPaneCategory>
    );
  } else {
    editor = (
      <div>
        <Field label={renderLabel()()} description={item.description}>
          <item.override
            value={property.value}
            onChange={(value) => {
              onChange(value);
            }}
            item={item}
            context={context}
          />
        </Field>
      </div>
    );
  }

  return (
    <div
      className={cx(
        isCollapsible && styles.collapsibleOverrideEditor,
        !isCollapsible && 'dynamicConfigValueEditor--nonCollapsible'
      )}
    >
      {editor}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    collapsibleOverrideEditor: css`
      label: collapsibleOverrideEditor;
      & + .dynamicConfigValueEditor--nonCollapsible {
        margin-top: ${theme.spacing.formSpacingBase}px;
      }
    `,
  };
});
