import {
  FieldConfigEditorBuilder,
  StandardEditorProps,
  FieldType,
  identityOverrideProcessor,
  SelectableValue,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphFieldConfig, StackingConfig, StackingMode } from '@grafana/schema';

import { RadioButtonGroup } from '../../components/Forms/RadioButtonGroup/RadioButtonGroup';
import { IconButton } from '../../components/IconButton/IconButton';
import { Input } from '../../components/Input/Input';
import { Stack } from '../../components/Layout/Stack/Stack';
import { getGraphFieldOptions } from '../../components/uPlot/config';

export const StackingEditor = ({
  value,
  context,
  onChange,
  item,
}: StandardEditorProps<StackingConfig, { options: Array<SelectableValue<StackingMode>> }>) => {
  return (
    <Stack>
      <RadioButtonGroup
        value={value?.mode || StackingMode.None}
        options={item.settings?.options ?? []}
        onChange={(v) => {
          onChange({
            ...value,
            mode: v,
          });
        }}
      />
      {context.isOverride && value?.mode && value?.mode !== StackingMode.None && (
        <Input
          type="text"
          placeholder={t('grafana-ui.stacking-builder.group', 'Group')}
          suffix={
            <IconButton
              name="question-circle"
              tooltip={t('grafana-ui.stacking-builder.group-tooltip', 'Name of the stacking group')}
              tooltipPlacement="top"
            />
          }
          defaultValue={value?.group}
          onChange={(v) => {
            onChange({
              ...value,
              group: v.currentTarget.value.trim(),
            });
          }}
        />
      )}
    </Stack>
  );
};

export function addStackingConfig(
  builder: FieldConfigEditorBuilder<GraphFieldConfig>,
  defaultConfig?: StackingConfig,
  category = ['Graph styles']
) {
  const graphFieldOptions = getGraphFieldOptions();
  builder.addCustomEditor({
    id: 'stacking',
    path: 'stacking',
    name: t('grafana-ui.builder.stacking.name-stack-series', 'Stack series'),
    category: category,
    defaultValue: defaultConfig,
    editor: StackingEditor,
    override: StackingEditor,
    settings: {
      options: graphFieldOptions.stacking,
    },
    process: identityOverrideProcessor,
    shouldApply: (f) => f.type === FieldType.number,
  });
}
