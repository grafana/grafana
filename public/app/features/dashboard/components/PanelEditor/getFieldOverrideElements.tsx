import React, { ReactElement } from 'react';
import { cloneDeep } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { Container, fieldMatchersUI, ValuePicker } from '@grafana/ui';
import { OverrideEditor } from './OverrideEditor';
import { OptionPaneRenderProps } from './types';
import { OptionsPaneCategoryProps } from './OptionsPaneCategory';

export function getFieldOverrideElements(props: OptionPaneRenderProps): Array<ReactElement<OptionsPaneCategoryProps>> {
  const elements: Array<ReactElement<OptionsPaneCategoryProps>> = [];
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

  currentFieldConfig.overrides.forEach((o, i) => {
    const name = `Override ${i + 1}`;

    elements.push(
      <OverrideEditor
        name={name}
        key={name}
        data={props.data?.series || []}
        override={o}
        onChange={(value) => onOverrideChange(i, value)}
        onRemove={() => onOverrideRemove(i)}
        registry={props.plugin.fieldConfigRegistry}
      />
    );
  });

  elements.push(
    <Container padding="md">
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

  //   <FeatureInfoBox
  //   title="Overrides"
  //   url={getDocsLink(DocsId.FieldConfigOverrides)}
  //   className={css`
  //     margin: ${theme.spacing.md};
  //   `}
  // >
  //   Field override rules give you a fine grained control over how your data is displayed.
  // </FeatureInfoBox>

  return elements;
}
