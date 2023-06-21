import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';

import {
  FieldConfigOptionsRegistry,
  SelectableValue,
  isSystemOverride as isSystemOverrideGuard,
  VariableSuggestionsScope,
  DynamicConfigValue,
  ConfigOverrideRule,
  GrafanaTheme2,
  fieldMatchers,
} from '@grafana/data';
import { fieldMatchersUI, useStyles2, ValuePicker } from '@grafana/ui';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OverrideCategoryTitle } from './OverrideCategoryTitle';
import { OptionPaneRenderProps } from './types';

export function getFieldOverrideCategories(
  props: OptionPaneRenderProps,
  searchQuery: string
): OptionsPaneCategoryDescriptor[] {
  const categories: OptionsPaneCategoryDescriptor[] = [];
  const currentFieldConfig = props.panel.fieldConfig;
  const registry = props.plugin.fieldConfigRegistry;
  const data = props.data?.series ?? [];

  if (registry.isEmpty()) {
    return [];
  }

  const onOverrideChange = (index: number, override: ConfigOverrideRule) => {
    let overrides = cloneDeep(currentFieldConfig.overrides);
    overrides[index] = override;
    props.onFieldConfigsChange({ ...currentFieldConfig, overrides });
  };

  const onOverrideRemove = (overrideIndex: number) => {
    let overrides = cloneDeep(currentFieldConfig.overrides);
    overrides.splice(overrideIndex, 1);
    props.onFieldConfigsChange({ ...currentFieldConfig, overrides });
  };

  const onOverrideAdd = (value: SelectableValue<string>) => {
    const info = fieldMatchers.get(value.value!);
    if (!info) {
      return;
    }

    props.onFieldConfigsChange({
      ...currentFieldConfig,
      overrides: [
        ...currentFieldConfig.overrides,
        {
          matcher: {
            id: info.id,
            options: info.defaultOptions,
          },
          properties: [],
        },
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
    const overrideName = `Override ${idx + 1}`;
    const matcherUi = fieldMatchersUI.get(override.matcher.id);
    const configPropertiesOptions = getOverrideProperties(registry);
    const isSystemOverride = isSystemOverrideGuard(override);
    // A way to force open new override categories
    const forceOpen = override.properties.length === 0 ? 1 : 0;

    const category = new OptionsPaneCategoryDescriptor({
      title: overrideName,
      id: overrideName,
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

    const onMatcherConfigChange = (options: any) => {
      override.matcher.options = options;
      onOverrideChange(idx, override);
    };

    const onDynamicConfigValueAdd = (o: ConfigOverrideRule, value: SelectableValue<string>) => {
      const registryItem = registry.get(value.value!);
      const propertyConfig: DynamicConfigValue = {
        id: registryItem.id,
        value: registryItem.defaultValue,
      };

      if (override.properties) {
        o.properties.push(propertyConfig);
      } else {
        o.properties = [propertyConfig];
      }

      onOverrideChange(idx, o);
    };

    /**
     * Add override matcher UI element
     */
    category.addItem(
      new OptionsPaneItemDescriptor({
        title: matcherUi.name,
        render: function renderMatcherUI() {
          return (
            <matcherUi.component
              id={`${matcherUi.matcher.id}-${idx}`}
              matcher={matcherUi.matcher}
              data={props.data?.series ?? []}
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
        override.properties[propIdx].value = value;
        onOverrideChange(idx, override);
      };

      const onPropertyRemove = () => {
        override.properties.splice(propIdx, 1);
        onOverrideChange(idx, override);
      };

      /**
       * Add override property item
       */
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: registryItemForProperty.name,
          skipField: true,
          render: function renderPropertyEditor() {
            return (
              <DynamicConfigValueEditor
                key={`${property.id}/${propIdx}`}
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
          title: '----------',
          skipField: true,
          render: function renderAddPropertyButton() {
            return (
              <ValuePicker
                key="Add override property"
                label="Add override property"
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
      title: 'add button',
      id: 'add button',
      customRender: function renderAddButton() {
        return (
          <AddOverrideButtonContainer key="Add override">
            <ValuePicker
              icon="plus"
              label="Add field override"
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
      return {
        label,
        value: item.id,
        description: item.description,
      };
    });
}

function AddOverrideButtonContainer({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getBorderTopStyles);
  return <div className={styles}>{children}</div>;
}

function getBorderTopStyles(theme: GrafanaTheme2) {
  return css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: `${theme.spacing(2)}`,
    display: 'flex',
  });
}
