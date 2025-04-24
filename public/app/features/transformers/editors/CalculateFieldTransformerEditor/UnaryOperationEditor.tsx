import { unaryOperators, SelectableValue, UnaryOperationID } from '@grafana/data';
import { UnaryOptions, CalculateFieldMode, CalculateFieldTransformerOptions } from '@grafana/data/internal';
import { InlineField, InlineFieldRow, InlineLabel, Select } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
        <InlineField
          label={t('transformers.unary-operation-editor.label-operation', 'Operation')}
          labelWidth={LABEL_WIDTH}
        >
          <Select options={ops} value={unary?.operator ?? ops[0].value} onChange={onUnaryOperationChanged} />
        </InlineField>
        <InlineField
          // eslint-disable-next-line @grafana/no-untranslated-strings
          label="("
          labelWidth={2}
        >
          <Select
            placeholder={t('transformers.unary-operation-editor.placeholder-field', 'Field')}
            className="min-width-11"
            options={fieldName}
            value={unary?.fieldName}
            onChange={onUnaryValueChanged}
          />
        </InlineField>
        {/* eslint-disable-next-line @grafana/no-untranslated-strings */}
        <InlineLabel width={2}>)</InlineLabel>
      </InlineFieldRow>
    </>
  );
};
