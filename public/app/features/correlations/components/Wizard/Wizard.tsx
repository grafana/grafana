import React from 'react';
import { useForm, FormProvider, FieldValues } from 'react-hook-form';

import { WizardContent } from './WizardContent';
import { WizardProps } from './types';
import { WizardContextProvider } from './wizardContext';

export function Wizard<T extends FieldValues>(props: WizardProps<T>) {
  const { defaultValues, pages, onSubmit, navigation } = props;
  const formMethods = useForm<T>({ defaultValues });
  return (
    <FormProvider {...formMethods}>
      <WizardContextProvider pages={pages} onSubmit={onSubmit}>
        <WizardContent navigation={navigation} />
      </WizardContextProvider>
    </FormProvider>
  );
}
