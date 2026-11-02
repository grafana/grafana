import { css, cx } from '@emotion/css';
import { useId } from 'react';
import Highlighter from 'react-highlight-words';

import {
  type DynamicConfigValue,
  type FieldConfigOptionsRegistry,
  FieldConfigProperty,
  type FieldOverrideContext,
  type GrafanaTheme2,
} from '@grafana/data';
import { type VarMappingKind } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { Counter, Field, Stack, IconButton, Label, useStyles2 } from '@grafana/ui';
import { VarMappingNumberValueEditor } from 'app/core/components/OptionsUI/number';
import { getVarMappingToggleKind, VarMappingToggleEditor } from 'app/core/components/OptionsUI/varMappingToggle';
import { type VarMappingVariableSource } from 'app/core/components/OptionsUI/varMappingVariables';

import { OptionsPaneCategory } from './OptionsPaneCategory';

interface DynamicConfigValueEditorProps {
  property: DynamicConfigValue;
  registry: FieldConfigOptionsRegistry;
  onChange: (value: unknown) => void;
  context: FieldOverrideContext;
  onRemove: () => void;
  isSystemOverride?: boolean;
  searchQuery: string;
  varMappingKind?: VarMappingKind;
  /** The rule's `varMappings.<id>` expression, read by the select, radio and switch toggle */
  varMappingExpression?: string;
  varMappingVariables?: VarMappingVariableSource;
}

export const DynamicConfigValueEditor = ({
  property,
  context,
  registry,
  onChange,
  onRemove,
  isSystemOverride,
  searchQuery,
  varMappingKind,
  varMappingExpression,
  varMappingVariables,
}: DynamicConfigValueEditorProps) => {
  const styles = useStyles2(getStyles);

  const item = registry?.getIfExists(property.id);

  const componentId = useId();

  if (!item) {
    return null;
  }

  const toggleKind = getVarMappingToggleKind(item, varMappingKind);
  const Override = item.override;
  const numberExpressions = varMappingKind === 'number' && !toggleKind;

  const isCollapsible =
    Array.isArray(property.value) ||
    property.id === FieldConfigProperty.Thresholds ||
    property.id === FieldConfigProperty.Links ||
    property.id === FieldConfigProperty.Mappings;

  const labelCategory = item.category?.filter((c) => c !== item.name);
  let editor;

  /* eslint-disable react/display-name */
  const renderLabel =
    (includeDescription = true, includeCounter = false) =>
    (isExpanded = false) => (
      <Stack justifyContent="space-between">
        <Label
          category={labelCategory}
          description={includeDescription ? item.description : undefined}
          htmlFor={componentId}
        >
          <Highlighter
            textToHighlight={item.name}
            searchWords={[searchQuery]}
            highlightClassName={'search-fragment-highlight'}
          />
          {!isExpanded && includeCounter && item.getItemsCount && (
            <Counter value={item.getItemsCount(property.value)} />
          )}
        </Label>
        {!isSystemOverride && (
          <div>
            <IconButton
              name="times"
              onClick={onRemove}
              tooltip={t(
                'dashboard.dynamic-config-value-editor.render-label.tooltip-remove-property',
                'Remove property'
              )}
            />
          </div>
        )}
      </Stack>
    );
  /* eslint-enable react/display-name */

  if (isCollapsible) {
    editor = (
      <OptionsPaneCategory
        id={item.name}
        renderTitle={renderLabel(false, true)}
        className={css({
          paddingLeft: 0,
          paddingRight: 0,
        })}
        isNested
        isOpenDefault={property.value !== undefined}
      >
        <Override
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
          {toggleKind ? (
            <VarMappingToggleEditor
              editor={item.override}
              kind={toggleKind}
              expression={varMappingExpression}
              variables={varMappingVariables}
              value={property.value}
              onChange={onChange}
              item={item}
              context={context}
              id={componentId}
            />
          ) : numberExpressions ? (
            <VarMappingNumberValueEditor
              value={
                typeof property.value === 'number' || typeof property.value === 'string' ? property.value : undefined
              }
              onChange={onChange}
              item={item}
              context={context}
              id={componentId}
              variables={varMappingVariables}
            />
          ) : (
            <Override
              value={property.value}
              onChange={(value) => {
                onChange(value);
              }}
              item={item}
              context={context}
              id={componentId}
            />
          )}
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

const getStyles = (theme: GrafanaTheme2) => ({
  collapsibleOverrideEditor: css({
    label: 'collapsibleOverrideEditor',
    '& + .dynamicConfigValueEditor--nonCollapsible': {
      marginTop: theme.spacing(1),
    },
  }),
});
