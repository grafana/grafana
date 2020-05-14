import { DynamicConfigValue, FieldConfigOptionsRegistry, FieldOverrideContext, GrafanaTheme } from '@grafana/data';
import React from 'react';
import { Counter, Field, HorizontalGroup, IconButton, Label, stylesFactory, useTheme } from '@grafana/ui';
import { css, cx } from 'emotion';
import { OptionsGroup } from './OptionsGroup';

interface DynamicConfigValueEditorProps {
  property: DynamicConfigValue;
  registry: FieldConfigOptionsRegistry;
  onChange: (value: DynamicConfigValue) => void;
  context: FieldOverrideContext;
  onRemove: () => void;
  isCollapsible?: boolean;
}

export const DynamicConfigValueEditor: React.FC<DynamicConfigValueEditorProps> = ({
  property,
  context,
  registry,
  onChange,
  onRemove,
  isCollapsible,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const item = registry?.getIfExists(property.id);

  if (!item) {
    return null;
  }
  let editor;

  const renderLabel = (includeDescription = true, includeCounter = false) => (isExpanded = false) => (
    <HorizontalGroup justify="space-between">
      <Label description={includeDescription ? item.description : undefined}>
        {item.name}
        {!isExpanded && includeCounter && item.getItemsCount && <Counter value={item.getItemsCount(property.value)} />}
      </Label>
      <div>
        <IconButton name="times" onClick={onRemove} />
      </div>
    </HorizontalGroup>
  );

  if (isCollapsible) {
    editor = (
      <OptionsGroup
        id={item.name}
        renderTitle={renderLabel(false, true)}
        className={css`
          padding-left: 0;
          padding-right: 0;
        `}
        nested
        defaultToClosed={property.value !== undefined}
      >
        <item.override
          value={property.value}
          onChange={value => {
            onChange(value);
          }}
          item={item}
          context={context}
        />
      </OptionsGroup>
    );
  } else {
    editor = (
      <div>
        <Field label={renderLabel()()} description={item.description}>
          <item.override
            value={property.value}
            onChange={value => {
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
