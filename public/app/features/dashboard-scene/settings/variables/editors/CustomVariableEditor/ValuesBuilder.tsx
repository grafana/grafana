import { forwardRef, useCallback } from 'react';
import { lastValueFrom } from 'rxjs';

import { CustomVariable, VariableValueOption, VariableValueSingle } from '@grafana/scenes';

import { VariableStaticOptionsForm, VariableStaticOptionsFormRef } from '../../components/VariableStaticOptionsForm';

interface ValuesBuilderProps {
  options: CustomVariable;
}

export const ValuesBuilder = forwardRef<VariableStaticOptionsFormRef, ValuesBuilderProps>(function (
  { variable }: ValuesBuilderProps,
  ref
) {


  return 
});

ValuesBuilder.displayName = 'ValuesBuilder';
