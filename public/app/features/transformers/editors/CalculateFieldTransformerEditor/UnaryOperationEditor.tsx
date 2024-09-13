import { unaryOperators, SelectableValue, UnaryOperationID } from '@grafana/data';
import {
  UnaryOptions,
  CalculateFieldMode,
  CalculateFieldTransformerOptions,
} from '@grafana/data/src/transformations/transformers/calculateField';
import { InlineField, InlineFieldRow, InlineLabel, Select } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const UnaryOperationEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { options, onChange } = props;
  const { unary } = options;

  const updateUnaryOptions = (v: UnaryOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.UnaryOperation,
      unary: v,
    });
  };

  const onUnaryOperationChanged = (v: SelectableValue<UnaryOperationID>) => {
    updateUnaryOptions({
      ...unary!,
      operator: v.value!,
    });
  };

  const onUnaryValueChanged = (v: SelectableValue<string>) => {
    updateUnaryOptions({
      ...unary!,
      fieldName: v.value!,
    });
  };

  let found = !unary?.fieldName;
  const names = props.names.map((v) => {
    if (v === unary?.fieldName) {
      found = true;
    }
    return { label: v, value: v };
  });

  const ops = unaryOperators.list().map((v) => {
    return { label: v.unaryOperationID, value: v.unaryOperationID };
  });

  const fieldName = found ? names : [...names, { label: unary?.fieldName, value: unary?.fieldName }];

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Operation" labelWidth={LABEL_WIDTH}>
          <Select options={ops} value={unary?.operator ?? ops[0].value} onChange={onUnaryOperationChanged} />
        </InlineField>
        <InlineField label="(" labelWidth={2}>
          <Select
            placeholder="Field"
            className="min-width-11"
            options={fieldName}
            value={unary?.fieldName}
            onChange={onUnaryValueChanged}
          />
        </InlineField>
        <InlineLabel width={2}>)</InlineLabel>
      </InlineFieldRow>
    </>
  );
};
