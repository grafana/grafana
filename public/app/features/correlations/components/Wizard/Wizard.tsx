import React, { useState } from 'react';
import { useForm, FormProvider, FieldValues } from 'react-hook-form';

import { Button } from '@grafana/ui';

import { WizardProps } from './types';

export function Wizard<T extends FieldValues>(props: WizardProps<T>) {
  const { pages, onSubmit, defaultValues } = props;

  const [currentPage, setCurrentPage] = useState(0);

  const formMethods = useForm<T>({ defaultValues });

  if (!pages[currentPage]) {
    return null;
  }

  const CurrentPageForm = pages[currentPage];

  return (
    <FormProvider {...formMethods}>
      <form
        onSubmit={formMethods.handleSubmit((data: T) => {
          const lastPage = currentPage === pages.length - 1;
          if (lastPage) {
            onSubmit(data);
          } else {
            setCurrentPage(currentPage + 1);
          }
        })}
      >
        <div>
          <CurrentPageForm />
        </div>

        {currentPage > 0 ? (
          <Button variant="secondary" onClick={() => setCurrentPage(currentPage - 1)}>
            Back
          </Button>
        ) : undefined}
        <Button variant="secondary" type="submit">
          {currentPage === pages.length - 1 ? 'Submit' : 'Next'}
        </Button>
      </form>
    </FormProvider>
  );
}
