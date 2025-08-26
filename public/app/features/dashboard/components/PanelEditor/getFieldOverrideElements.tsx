import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

import {
  FieldConfigOptionsRegistry,
  SelectableValue,
  isSystemOverride as isSystemOverrideGuard,
  VariableSuggestionsScope,
  DynamicConfigValue,
  ConfigOverrideRule,
  GrafanaTheme2,
  fieldMatchers,
  FieldConfigSource,
  DataFrame,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { fieldMatchersUI, useStyles2, ValuePicker } from '@grafana/ui';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OverrideCategoryTitle } from './OverrideCategoryTitle';

// [FIXME] Is there something else we need to do in here?

export function getFieldOverrideCategories(
  fieldConfig: FieldConfigSource,
  registry: FieldConfigOptionsRegistry,
  data: DataFrame[],
  searchQuery: string,
  onFieldConfigsChange: (config: FieldConfigSource) => void
): OptionsPaneCategoryDescriptor[] {
  const categories: OptionsPaneCategoryDescriptor[] = [];
  const currentFieldConfig = fieldConfig;

  if (!registry || registry.isEmpty()) {
    return [];
  }

  const onOverrideChange = (index: number, override: ConfigOverrideRule) => {
    let overrides = cloneDeep(currentFieldConfig.overrides);
    overrides[index] = override;
    onFieldConfigsChange({ ...currentFieldConfig, overrides });
  };

  const onOverrideRemove = (overrideIndex: number) => {
    let overrides = cloneDeep(currentFieldConfig.overrides);
    overrides.splice(overrideIndex, 1);
    onFieldConfigsChange({ ...currentFieldConfig, overrides });
  };

  const onOverrideAdd = (value: SelectableValue<string>) => {
    const info = fieldMatchers.get(value.value!);
    if (!info) {
      return;
    }

    onFieldConfigsChange({
      ...currentFieldConfig,
      overrides: [
        ...currentFieldConfig.overrides,
        { matcher: { id: info.id, options: info.defaultOptions }, properties: [] },
      ],
    });
  };

  const context = {
    data,
    getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
    isOverride: true,
  };

  /**
   * Main loop through all override rules
   */
  for (let idx = 0; idx < currentFieldConfig.overrides.length; idx++) {
    const override = currentFieldConfig.overrides[idx];
    const overrideName = t('dashboard.get-field-override-categories.override-name', 'Override {{overrideNum}}', {
      overrideNum: idx + 1,
    });
    const overrideId = `override-${idx}`;
    const matcherUi = fieldMatchersUI.get(override.matcher.id);
    const configPropertiesOptions = getOverrideProperties(registry);
    const isSystemOverride = isSystemOverrideGuard(override);
    // A way to force open new override categories
    const forceOpen = override.properties.length === 0;

    const category = new OptionsPaneCategoryDescriptor({
      title: overrideName,
      id: overrideId,
      forceOpen,
      renderTitle: function renderOverrideTitle(isExpanded: boolean) {
        return (
          <OverrideCategoryTitle
            override={override}
            isExpanded={isExpanded}
            registry={registry}
            overrideName={overrideName}
            matcherUi={matcherUi}
            onOverrideRemove={() => onOverrideRemove(idx)}
          />
        );
      },
    });

    const onMatcherConfigChange = (options: unknown) => {
      onOverrideChange(idx, { ...override, matcher: { ...override.matcher, options } });
    };

    const onDynamicConfigValueAdd = (override: ConfigOverrideRule, value: SelectableValue<string>) => {
      const registryItem = registry.get(value.value!);
      const propertyConfig: DynamicConfigValue = { id: registryItem.id, value: registryItem.defaultValue };

      const properties = override.properties ?? [];
      properties.push(propertyConfig);

      onOverrideChange(idx, { ...override, properties });
    };

    /**
     * Add override matcher UI element
     */
    const htmlId = uuidv4();
    category.addItem(
      new OptionsPaneItemDescriptor({
        id: htmlId,
        title: matcherUi.name,
        render: function renderMatcherUI() {
          return (
            <matcherUi.component
              id={htmlId}
              matcher={matcherUi.matcher}
              data={data ?? []}
              options={override.matcher.options}
              onChange={onMatcherConfigChange}
            />
          );
        },
      })
    );

    /**
     * Loop through all override properties
     */
    for (let propIdx = 0; propIdx < override.properties.length; propIdx++) {
      const property = override.properties[propIdx];
      const registryItemForProperty = registry.getIfExists(property.id);

      if (!registryItemForProperty) {
        continue;
      }

      const onPropertyChange = (value: DynamicConfigValue) => {
        onOverrideChange(idx, {
          ...override,
          properties: override.properties.map((prop, i) => {
            if (i === propIdx) {
              return { ...prop, value: value };
            }

            return prop;
          }),
        });
      };

      const onPropertyRemove = () => {
        onOverrideChange(idx, { ...override, properties: override.properties.filter((_, i) => i !== propIdx) });
      };

      const htmlId = `${overrideId}-${property.id}`;

      /**
       * Add override property item
       */
      category.addItem(
        new OptionsPaneItemDescriptor({
          skipField: true,
          id: htmlId,
          render: function renderPropertyEditor() {
            return (
              <DynamicConfigValueEditor
                key={htmlId}
                isSystemOverride={isSystemOverride}
                onChange={onPropertyChange}
                onRemove={onPropertyRemove}
                property={property}
                registry={registry}
                context={context}
                searchQuery={searchQuery}
              />
            );
          },
        })
      );
    }

    /**
     * Add button that adds new overrides
     */
    if (!isSystemOverride && override.matcher.options) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          skipField: true,
          id: `${overrideId}-add-button`,
          render: function renderAddPropertyButton() {
            return (
              <ValuePicker
                key="Add override property"
                label={t(
                  'dashboard.get-field-override-categories.label-add-override-property',
                  'Add override property'
                )}
                variant="secondary"
                isFullWidth={true}
                icon="plus"
                menuPlacement="auto"
                options={configPropertiesOptions}
                onChange={(v) => onDynamicConfigValueAdd(override, v)}
              />
            );
          },
        })
      );
    }

    categories.push(category);
  }

  categories.push(
    new OptionsPaneCategoryDescriptor({
      title: t('dashboard.get-field-override-categories.title.add-button', 'add button'),
      id: 'add button',
      customRender: function renderAddButton() {
        return (
          <AddOverrideButtonContainer key="Add override">
            <ValuePicker
              icon="plus"
              label={t('dashboard.get-field-override-categories.label-add-field-override', 'Add field override')}
              variant="secondary"
              menuPlacement="auto"
              isFullWidth={true}
              size="md"
              options={fieldMatchersUI
                .list()
                .filter((o) => !o.excludeFromPicker)
                .map<SelectableValue<string>>((i) => ({ label: i.name, value: i.id, description: i.description }))}
              onChange={(value) => onOverrideAdd(value)}
            />
          </AddOverrideButtonContainer>
        );
      },
    })
  );

  return categories;
}

function getOverrideProperties(registry: FieldConfigOptionsRegistry) {
  return registry
    .list()
    .filter((o) => !o.hideFromOverrides)
    .map((item) => {
      let label = item.name;
      if (item.category) {
        label = [...item.category, item.name].join(' > ');
      }
      return { label, value: item.id, description: item.description };
    });
}

function AddOverrideButtonContainer({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getBorderTopStyles);
  return <div className={styles}>{children}</div>;
}

function getBorderTopStyles(theme: GrafanaTheme2) {
  return css({ borderTop: `1px solid ${theme.colors.border.weak}`, padding: `${theme.spacing(2)}`, display: 'flex' });
}
