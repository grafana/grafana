import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';

import {
  type FieldConfigOptionsRegistry,
  type SelectableValue,
  isSystemOverride as isSystemOverrideGuard,
  type VariableSuggestionsScope,
  type DynamicConfigValue,
  type ConfigOverrideRule,
  fieldMatchers,
  type FieldConfigSource,
  type DataFrame,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type MatcherScope } from '@grafana/schema';
import {
  fieldMatchersUI,
  getUniqueMatcherScopes,
  MatcherScopeSelector,
  buildScopeOptions,
  useStyles2,
  ValuePicker,
  useFieldMatchersOptions,
} from '@grafana/ui';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OverrideCategoryTitle } from './OverrideCategoryTitle';

const ALLOWED_SCOPES: MatcherScope[] = ['series'];
if (config.featureToggles.nestedFramesFieldOverrides) {
  ALLOWED_SCOPES.push('nested');
}

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

  const uniqueMatcherScopes = getUniqueMatcherScopes(data);

  /**
   * Main loop through all override rules
   */
  for (let idx = 0; idx < currentFieldConfig.overrides.length; idx++) {
    const override = currentFieldConfig.overrides[idx];
    const overrideName = t('dashboard.get-field-override-categories.override-name', 'Override {{overrideNum}}', {
      overrideNum: idx + 1,
    });
    const overrideId = `panel-options-override-${idx}`;
    const matcherUi = fieldMatchersUI.get(override.matcher.id);
    const configPropertiesOptions = registry.selectOptions(
      undefined,
      (item) => !item.hideFromOverrides,
      (item) => {
        let label = item.name;
        if (item.category) {
          label = [...item.category, item.name].join(' > ');
        }
        return label;
      }
    ).options;
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

    const onMatcherConfigChange = (options: unknown, scope: MatcherScope | undefined = override.matcher.scope) => {
      onOverrideChange(idx, { ...override, matcher: { ...override.matcher, scope, options } });
    };

    const onMatcherScopeChange = (scope: MatcherScope) => {
      onOverrideChange(idx, { ...override, matcher: { ...override.matcher, scope } });
    };

    const onDynamicConfigValueAdd = (override: ConfigOverrideRule, value: SelectableValue<string>) => {
      const registryItem = registry.get(value.value!);
      const propertyConfig: DynamicConfigValue = { id: registryItem.id, value: registryItem.defaultValue };

      const properties = override.properties ?? [];
      properties.push(propertyConfig);

      onOverrideChange(idx, { ...override, properties });
    };

    const hasInvalidScope = override.matcher.scope && !uniqueMatcherScopes.has(override.matcher.scope);
    const scopeOptions = buildScopeOptions(uniqueMatcherScopes, override.matcher.scope, ALLOWED_SCOPES);
    const shouldShowScopeSelector = scopeOptions.length > 1 || hasInvalidScope;

    const htmlId = `${overrideId}-matcher`;
    if (shouldShowScopeSelector) {
      const scopeId = `${overrideId}-scope`;
      category.addItem(
        new OptionsPaneItemDescriptor({
          id: scopeId,
          title: t('grafana-ui.field-name-by-regex-matcher.scope', 'Target fields'),
          // @todo tooltips should be possible to add to an OptionsPanelItemDescriptor
          // tooltip: t('grafana-ui.field-name-by-regex-matcher.scope-tooltip', 'To avoid issues when applying overrides, overrides cannot be applied across multiple target scopes. The default "dataframe" scope is applied if no scope is selected.'),
          render: function renderMatcherScopeEditor() {
            return (
              <MatcherScopeSelector
                id={scopeId}
                value={override.matcher.scope}
                scopes={uniqueMatcherScopes}
                onChange={onMatcherScopeChange}
                allowedScopes={ALLOWED_SCOPES}
              />
            );
          },
        })
      );
    }

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
              scope={override.matcher.scope}
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

      const htmlId = `${overrideId}-property-${property.id}`;

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
      customRender: () => <AddButtonWrapper key="Add override" onOverrideAdd={onOverrideAdd} />,
    })
  );

  return categories;
}

function AddButtonWrapper({ onOverrideAdd }: { onOverrideAdd: (value: SelectableValue<string>) => void }) {
  const options = useFieldMatchersOptions();
  const styles = useStyles2((theme) =>
    css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      padding: `${theme.spacing(2)}`,
      display: 'flex',
    })
  );

  return (
    <div className={styles}>
      <ValuePicker
        icon="plus"
        label={t('dashboard.get-field-override-categories.label-add-field-override', 'Add field override')}
        variant="secondary"
        menuPlacement="auto"
        isFullWidth={true}
        size="md"
        options={options}
        onChange={(value) => onOverrideAdd(value)}
      />
    </div>
  );
}
