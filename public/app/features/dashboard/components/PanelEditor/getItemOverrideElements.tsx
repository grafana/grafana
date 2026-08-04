import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';

import {
  type DataFrame,
  type DynamicConfigValue,
  type FieldConfigSource,
  type ItemKindContext,
  type ItemKindDescriptor,
  type ItemOverrideRule,
  type PanelPlugin,
  type SelectableValue,
  type VariableSuggestionsScope,
  itemMatchers,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, ItemKindSelector, itemMatchersUI, useItemMatchersOptions, useStyles2, ValuePicker } from '@grafana/ui';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OverrideCategoryTitle } from './OverrideCategoryTitle';

/**
 * Builds the "Item overrides" section of the options pane.
 *
 * Structurally the same as `getFieldOverrideCategories`, but each rule also carries a kind, and
 * the property registry is looked up per kind rather than being one registry for the whole panel.
 */
export function getItemOverrideCategories(
  fieldConfig: FieldConfigSource,
  plugin: PanelPlugin,
  data: DataFrame[],
  itemContext: ItemKindContext,
  searchQuery: string,
  onFieldConfigsChange: (config: FieldConfigSource) => void
): OptionsPaneCategoryDescriptor[] {
  const kinds = plugin.itemKinds;

  if (!kinds.length) {
    return [];
  }

  const categories: OptionsPaneCategoryDescriptor[] = [];
  const currentFieldConfig = fieldConfig;
  const itemOverrides = currentFieldConfig.itemOverrides ?? [];

  const onOverrideChange = (index: number, override: ItemOverrideRule) => {
    const next = cloneDeep(itemOverrides);
    next[index] = override;
    onFieldConfigsChange({ ...currentFieldConfig, itemOverrides: next });
  };

  const onOverrideRemove = (index: number) => {
    const next = cloneDeep(itemOverrides);
    next.splice(index, 1);
    onFieldConfigsChange({ ...currentFieldConfig, itemOverrides: next });
  };

  const onOverrideAdd = (value: SelectableValue<string>) => {
    const info = itemMatchers.getIfExists(value.value!);
    if (!info) {
      return;
    }

    onFieldConfigsChange({
      ...currentFieldConfig,
      itemOverrides: [
        ...itemOverrides,
        { matcher: { id: info.id, kind: kinds[0].id, options: info.defaultOptions }, properties: [] },
      ],
    });
  };

  for (let idx = 0; idx < itemOverrides.length; idx++) {
    const override = itemOverrides[idx];
    const kind: ItemKindDescriptor | undefined = kinds.find((k) => k.id === override.matcher.kind);
    const registry = plugin.getItemConfigRegistry(override.matcher.kind);

    const overrideName = t('dashboard.get-item-override-categories.override-name', 'Item override {{overrideNum}}', {
      overrideNum: idx + 1,
    });
    const overrideId = `panel-options-item-override-${idx}`;
    const matcherUi = itemMatchersUI.getIfExists(override.matcher.id);

    // A rule can reference a kind this plugin does not declare (panel type switched, or
    // hand-edited JSON) or a matcher with no editor. Render a non-crashing state for both so
    // the rule can still be removed.
    if (!kind || !registry || !matcherUi) {
      categories.push(
        buildUnresolvableCategory({
          override,
          overrideId,
          overrideName,
          hasKind: Boolean(kind),
          onOverrideRemove: () => onOverrideRemove(idx),
        })
      );
      continue;
    }

    const context = {
      data,
      getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
      isOverride: true,
    };

    const configPropertiesOptions = registry.selectOptions(
      undefined,
      (item) => !item.hideFromOverrides,
      (item) => (item.category ? [...item.category, item.name].join(' > ') : item.name)
    ).options;

    // A way to force open new override categories
    const forceOpen = override.properties.length === 0;

    const category = new OptionsPaneCategoryDescriptor({
      title: overrideName,
      id: overrideId,
      forceOpen,
      renderTitle: function renderOverrideTitle(isExpanded: boolean) {
        return (
          <OverrideCategoryTitle
            isExpanded={isExpanded}
            overrideName={overrideName}
            matcherLabel={`${kind.name} > ${matcherUi.optionsToLabel(override.matcher.options)}`}
            propertyNames={override.properties
              .map((p) => registry.getIfExists(p.id)?.name)
              .filter((name): name is string => !!name)}
            onOverrideRemove={() => onOverrideRemove(idx)}
          />
        );
      },
    });

    const onMatcherConfigChange = (options: unknown) => {
      onOverrideChange(idx, { ...override, matcher: { ...override.matcher, options } });
    };

    const onKindChange = (kindId: string) => {
      const nextRegistry = plugin.getItemConfigRegistry(kindId);
      onOverrideChange(idx, {
        matcher: { ...override.matcher, kind: kindId, options: undefined },
        // Kinds offer different properties, so drop the ones the new kind cannot express
        // rather than leaving rules that silently do nothing.
        properties: override.properties.filter((p) => nextRegistry?.getIfExists(p.id) !== undefined),
      });
    };

    const onDynamicConfigValueAdd = (value: SelectableValue<string>) => {
      const registryItem = registry.get(value.value!);
      onOverrideChange(idx, {
        ...override,
        properties: [...(override.properties ?? []), { id: registryItem.id, value: registryItem.defaultValue }],
      });
    };

    if (kinds.length > 1) {
      const kindId = `${overrideId}-kind`;
      category.addItem(
        new OptionsPaneItemDescriptor({
          id: kindId,
          title: t('dashboard.get-item-override-categories.target-items', 'Target items'),
          render: function renderKindSelector() {
            return <ItemKindSelector id={kindId} value={override.matcher.kind} kinds={kinds} onChange={onKindChange} />;
          },
        })
      );
    }

    const matcherHtmlId = `${overrideId}-matcher`;
    category.addItem(
      new OptionsPaneItemDescriptor({
        id: matcherHtmlId,
        title: matcherUi.name,
        render: function renderMatcherUI() {
          return (
            <matcherUi.component
              id={matcherHtmlId}
              matcher={matcherUi.matcher}
              kind={kind}
              data={data ?? []}
              itemContext={itemContext}
              options={override.matcher.options}
              onChange={onMatcherConfigChange}
            />
          );
        },
      })
    );

    for (let propIdx = 0; propIdx < override.properties.length; propIdx++) {
      const property = override.properties[propIdx];

      if (!registry.getIfExists(property.id)) {
        continue;
      }

      const onPropertyChange = (value: DynamicConfigValue) => {
        onOverrideChange(idx, {
          ...override,
          properties: override.properties.map((prop, i) => (i === propIdx ? { ...prop, value } : prop)),
        });
      };

      const onPropertyRemove = () => {
        onOverrideChange(idx, { ...override, properties: override.properties.filter((_, i) => i !== propIdx) });
      };

      const htmlId = `${overrideId}-property-${property.id}`;

      category.addItem(
        new OptionsPaneItemDescriptor({
          skipField: true,
          id: htmlId,
          render: function renderPropertyEditor() {
            return (
              <DynamicConfigValueEditor
                key={htmlId}
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

    category.addItem(
      new OptionsPaneItemDescriptor({
        skipField: true,
        id: `${overrideId}-add-button`,
        render: function renderAddPropertyButton() {
          return (
            <ValuePicker
              key="Add item override property"
              label={t('dashboard.get-item-override-categories.label-add-override-property', 'Add override property')}
              variant="secondary"
              isFullWidth={true}
              icon="plus"
              menuPlacement="auto"
              options={configPropertiesOptions}
              onChange={onDynamicConfigValueAdd}
            />
          );
        },
      })
    );

    categories.push(category);
  }

  categories.push(
    new OptionsPaneCategoryDescriptor({
      title: t('dashboard.get-item-override-categories.title.add-button', 'add item override button'),
      id: 'add item override button',
      customRender: () => <AddButtonWrapper key="Add item override" onOverrideAdd={onOverrideAdd} />,
    })
  );

  return categories;
}

interface UnresolvableCategoryProps {
  override: ItemOverrideRule;
  overrideId: string;
  overrideName: string;
  hasKind: boolean;
  onOverrideRemove: () => void;
}

function buildUnresolvableCategory({
  override,
  overrideId,
  overrideName,
  hasKind,
  onOverrideRemove,
}: UnresolvableCategoryProps): OptionsPaneCategoryDescriptor {
  const category = new OptionsPaneCategoryDescriptor({
    title: overrideName,
    id: overrideId,
    forceOpen: true,
    renderTitle: function renderOverrideTitle(isExpanded: boolean) {
      return (
        <OverrideCategoryTitle
          isExpanded={isExpanded}
          overrideName={overrideName}
          matcherLabel={`${override.matcher.kind} > ${override.matcher.id}`}
          propertyNames={override.properties.map((p) => p.id)}
          onOverrideRemove={onOverrideRemove}
        />
      );
    },
  });

  category.addItem(
    new OptionsPaneItemDescriptor({
      skipField: true,
      id: `${overrideId}-unresolvable`,
      render: function renderUnresolvable() {
        if (!hasKind) {
          return (
            <Alert
              severity="error"
              title={t('dashboard.get-item-override-categories.title-unknown-kind', 'Unknown item kind "{{kind}}"', {
                kind: override.matcher.kind,
              })}
            >
              {t(
                'dashboard.get-item-override-categories.body-unknown-kind',
                'This panel does not support this kind of item. This override has no effect. Remove it, or correct the kind in the dashboard JSON.'
              )}
            </Alert>
          );
        }

        return (
          <Alert
            severity="error"
            title={t(
              'dashboard.get-item-override-categories.title-unknown-matcher',
              'Unknown item matcher type "{{matcherId}}"',
              { matcherId: override.matcher.id }
            )}
          >
            {t(
              'dashboard.get-item-override-categories.body-unknown-matcher',
              'This override has no effect. Remove it, or correct the matcher id in the dashboard JSON.'
            )}
          </Alert>
        );
      },
    })
  );

  return category;
}

function AddButtonWrapper({ onOverrideAdd }: { onOverrideAdd: (value: SelectableValue<string>) => void }) {
  const options = useItemMatchersOptions();
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
        label={t('dashboard.get-item-override-categories.label-add-item-override', 'Add item override')}
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
