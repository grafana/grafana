import { useCallback } from 'react';

import { TransformerUIProps, StringFieldConfigSettings, StandardEditorsRegistryItem } from '@grafana/data';
import { CalculateFieldMode, CalculateFieldTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { StringValueEditor } from 'app/core/components/OptionsUI/string';

import { LABEL_WIDTH } from './constants';

// todo: check why not-scenes throws an error here https://github.com/grafana/grafana/blob/main/public/app/features/templating/template_srv.ts#L297

export const TemplateExpressionOptionsEditor = ({
  input,
  options,
  onChange,
}: TransformerUIProps<CalculateFieldTransformerOptions>) => {
  const replaceFn = getTemplateSrv().replace;
  const onTemplateExpressionChanged = useCallback(
    (value?: string) => {
      onChange({
        ...options,
        mode: CalculateFieldMode.TemplateExpression,
        template: {
          expression: value ?? '',
          replaceFn,
        },
      });
    },
    [onChange, options, replaceFn]
  );

  const dummyStringSettings: StandardEditorsRegistryItem<string, StringFieldConfigSettings> = {
    id: '',
    name: '',
    description: '',
    editor: StringValueEditor,
    settings: {},
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField
          labelWidth={LABEL_WIDTH}
          label={t('transformers.template-expression-options-editor.label-expression', 'Expression')}
          tooltip={t(
            'transformers.template-expression-options-editor.tooltip-transform-template-expression',
            'Transform a template expression into a field value'
          )}
        >
          <StringValueEditor
            context={{ data: input }}
            value={options.template?.expression ?? ''}
            onChange={onTemplateExpressionChanged}
            item={dummyStringSettings}
            preserveWhitespace={true}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
