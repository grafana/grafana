import { BinaryOperationID, binaryOperators, FieldMatcherID, FieldType, SelectableValue } from '@grafana/data';
import {
  BinaryValue,
  BinaryOptions,
  CalculateFieldMode,
  CalculateFieldTransformerOptions,
  checkBinaryValueType,
} from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { getFieldTypeIconName, InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const BinaryOperationOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  onChange: (options: CalculateFieldTransformerOptions) => void;
  names: string[];
}) => {
  const { options, onChange } = props;
  const newLeft = checkBinaryValueType(props.options.binary?.left ?? '', props.names);
  const newRight = checkBinaryValueType(props.options.binary?.right ?? '', props.names);
  // If there is a change due to migration, update save model
  if (newLeft !== props.options.binary?.left || newRight !== props.options.binary?.right) {
    onChange({
      ...options,
      mode: CalculateFieldMode.BinaryOperation,
      binary: { operator: options.binary?.operator!, left: newLeft, right: newRight },
    });
  }

  const { binary } = options;

  let foundLeft = !binary?.left;
  let foundRight = !binary?.right;

  const fixedValueLeft = !binary?.left?.matcher;
  const fixedValueRight = !binary?.right?.matcher;
  const matcherOptionsLeft = binary?.left?.matcher?.options;
  const matcherOptionsRight = binary?.right?.matcher?.options;

  const byNameLeft = binary?.left?.matcher?.id === FieldMatcherID.byName;
  const byNameRight = binary?.right?.matcher?.id === FieldMatcherID.byName;
  const names = props.names.map((v) => {
    if (byNameLeft && v === matcherOptionsLeft) {
      foundLeft = true;
    }
    if (byNameRight && v === matcherOptionsRight) {
      foundRight = true;
    }
    return { label: v, value: JSON.stringify({ matcher: { id: FieldMatcherID.byName, options: v } }) };
  });

  // Populate left and right names with missing name only for byName
  const leftNames = foundLeft
    ? [...names]
    : byNameLeft
      ? [...names, { label: matcherOptionsLeft, value: JSON.stringify(binary.left), icon: '' }]
      : [...names];
  const rightNames = foundRight
    ? [...names]
    : byNameRight
      ? [...names, { label: matcherOptionsRight, value: JSON.stringify(binary.right), icon: '' }]
      : [...names];

  // Add byTypes to left names ONLY - avoid all number fields operated by all number fields
  leftNames.push({
    label: `All ${FieldType.number} fields`,
    value: JSON.stringify({ matcher: { id: FieldMatcherID.byType, options: FieldType.number } }),
    icon: getFieldTypeIconName(FieldType.number),
  });

  // Add fixed values to left and right names
  if (fixedValueLeft && binary?.left?.fixed) {
    leftNames.push({ label: binary.left.fixed, value: JSON.stringify(binary.left) ?? '', icon: '' });
  }
  if (fixedValueRight && binary?.right?.fixed) {
    rightNames.push({ label: binary.right.fixed, value: JSON.stringify(binary.right) ?? '', icon: '' });
  }

  const ops = binaryOperators.list().map((v) => {
    return { label: v.binaryOperationID, value: v.binaryOperationID };
  });

  const updateBinaryOptions = (v: BinaryOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.BinaryOperation,
      binary: v,
    });
  };

  // if the operator is missing, set a default value
  if (!binary?.operator) {
    updateBinaryOptions({
      ...binary!,
      operator: ops[0].value,
    });
  }

  const onBinaryLeftChanged = (v: SelectableValue<string>) => {
    const vObject: BinaryValue = JSON.parse(v.value ?? '');
    // If no matcher, treat as fixed value
    if (!vObject.matcher) {
      updateBinaryOptions({
        ...binary!,
        left: { fixed: vObject.fixed ?? v.value?.toString() },
      });
    } else {
      updateBinaryOptions({
        ...binary!,
        left: vObject,
      });
    }
  };

  const onBinaryRightChanged = (v: SelectableValue<string>) => {
    const vObject: BinaryValue = JSON.parse(v.value ?? '');
    // If no matcher, treat as fixed value
    if (!vObject.matcher) {
      updateBinaryOptions({
        ...binary!,
        right: { fixed: vObject.fixed ?? v.value?.toString() },
      });
    } else {
      updateBinaryOptions({
        ...binary!,
        right: vObject,
      });
    }
  };

  const onBinaryOperationChanged = (v: SelectableValue<BinaryOperationID>) => {
    updateBinaryOptions({
      ...binary!,
      operator: v.value!,
    });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={t('transformers.binary-operation-options-editor.label-operation', 'Operation')}
          labelWidth={LABEL_WIDTH}
        >
          <Select
            allowCustomValue={true}
            placeholder={t(
              'transformers.binary-operation-options-editor.placeholder-fields-or-number',
              'Field(s) or number'
            )}
            options={leftNames}
            className="min-width-18"
            value={JSON.stringify(binary?.left)}
            onChange={onBinaryLeftChanged}
          />
        </InlineField>
        <InlineField>
          <Select className="width-4" options={ops} value={binary?.operator} onChange={onBinaryOperationChanged} />
        </InlineField>
        <InlineField>
          <Select
            allowCustomValue={true}
            placeholder={t(
              'transformers.binary-operation-options-editor.placeholder-field-or-number',
              'Field or number'
            )}
            className="min-width-10"
            options={rightNames}
            value={JSON.stringify(binary?.right)}
            onChange={onBinaryRightChanged}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
