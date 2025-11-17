import { forwardRef, useCallback } from 'react';
import { lastValueFrom } from 'rxjs';

import { CustomVariable, VariableValueOption, VariableValueSingle } from '@grafana/scenes';

import { VariableStaticOptionsForm, VariableStaticOptionsFormRef } from '../../components/VariableStaticOptionsForm';

interface ValuesBuilderProps {
  variable: CustomVariable;
}

export const ValuesBuilder = forwardRef<VariableStaticOptionsFormRef, ValuesBuilderProps>(function (
  { variable }: ValuesBuilderProps,
  ref
) {
  const { query } = variable.useState();

  const options = variable.transformCsvStringToOptions(query, false).map(({ label, value }) => ({
    value,
    label: value === label ? '' : label,
  }));

  const escapeEntities = useCallback((text: VariableValueSingle) => String(text).trim().replaceAll(',', '\\,'), []);

  const formatOption = useCallback(
    (option: VariableValueOption) => {
      if (!option.label || option.label === option.value) {
        return escapeEntities(option.value);
      }

      return `${escapeEntities(option.label)} : ${escapeEntities(String(option.value))}`;
    },
    [escapeEntities]
  );

  const generateQuery = useCallback(
    (options: VariableValueOption[]) => options.map(formatOption).join(', '),
    [formatOption]
  );

  const handleOptionsChange = useCallback(
    async (options: VariableValueOption[]) => {
      variable.setState({ query: generateQuery(options) });
      await lastValueFrom(variable.validateAndUpdate!());
    },
    [variable, generateQuery]
  );

  return <VariableStaticOptionsForm options={options} onChange={handleOptionsChange} ref={ref} isInModal />;
});

ValuesBuilder.displayName = 'ValuesBuilder';
