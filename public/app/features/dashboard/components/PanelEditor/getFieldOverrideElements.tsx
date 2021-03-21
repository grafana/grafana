import React from 'react';
import { cloneDeep } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Container, fieldMatchersUI, ValuePicker } from '@grafana/ui';
import { OverrideEditor } from './OverrideEditor';
import { OptionPaneRenderProps } from './types';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneItems';

export function getFieldOverrideCategories(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor[] {
  const categories: OptionsPaneCategoryDescriptor[] = [];
  const currentFieldConfig = props.panel.fieldConfig;

  const onOverrideChange = (index: number, override: any) => {
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
    props.onFieldConfigsChange({
      ...currentFieldConfig,
      overrides: [
        ...currentFieldConfig.overrides,
        {
          matcher: {
            id: value.value!,
          },
          properties: [],
        },
      ],
    });
  };

  for (let idx = 0; idx < currentFieldConfig.overrides.length; idx++) {
    const override = currentFieldConfig.overrides[idx];
    const name = `Override ${idx + 1}`;

    categories.push(
      new OptionsPaneCategoryDescriptor({
        title: name,
        id: name,
        customRender: function renderOverrideRule() {
          return (
            <OverrideEditor
              name={name}
              key={name}
              data={props.data?.series || []}
              override={override}
              onChange={(value) => onOverrideChange(idx, value)}
              onRemove={() => onOverrideRemove(idx)}
              registry={props.plugin.fieldConfigRegistry}
            />
          );
        },
      })
    );
  }

  categories.push(
    new OptionsPaneCategoryDescriptor({
      title: 'add button',
      id: 'add button',
      customRender: function renderAddButton() {
        return (
          <Container padding="md" key="Add override">
            <ValuePicker
              icon="plus"
              label="Add an override"
              variant="secondary"
              size="sm"
              menuPlacement="auto"
              options={fieldMatchersUI
                .list()
                .filter((o) => !o.excludeFromPicker)
                .map<SelectableValue<string>>((i) => ({ label: i.name, value: i.id, description: i.description }))}
              onChange={(value) => onOverrideAdd(value)}
              isFullWidth={true}
            />
          </Container>
        );
      },
    })
  );

  //   <FeatureInfoBox
  //   title="Overrides"
  //   url={getDocsLink(DocsId.FieldConfigOverrides)}
  //   className={css`
  //     margin: ${theme.spacing.md};
  //   `}
  // >
  //   Field override rules give you a fine grained control over how your data is displayed.
  // </FeatureInfoBox>

  return categories;
}

// function getOverrideProperties(plugin: PanelPlugin) {
//   return plugin.fieldConfigRegistry
//     .list()
//     .filter((o) => !o.hideFromOverrides)
//     .map((item) => {
//       let label = item.name;
//       if (item.category && item.category.length > 1) {
//         label = [...item.category!.slice(1), item.name].join(' > ');
//       }
//       return {
//         label,
//         value: item.id,
//         description: item.description,
//       };
//     });
// }
