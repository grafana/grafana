import { type PropsWithChildren } from 'react';
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { act, render, screen } from 'test/test-utils';

import { mockImportFormValues } from '../testUtils';
import { type ImportFormValues } from '../types';

import { PolicyTreeNameField } from './PolicyTreeNameField';

function setup({ autoSyncActive, name }: { autoSyncActive: boolean; name: string }) {
  const validate = jest.fn().mockResolvedValue('taken');
  let form!: UseFormReturn<ImportFormValues>;
  function Wrapper({ children }: PropsWithChildren) {
    form = useForm<ImportFormValues>({ defaultValues: mockImportFormValues({ policyTreeName: name }) });
    return <FormProvider {...form}>{children}</FormProvider>;
  }
  render(
    <Wrapper>
      <PolicyTreeNameField
        autoSyncActive={autoSyncActive}
        autoSyncIdentifier="mimir-sync"
        autoSyncConflictMessage={undefined}
        validate={validate}
        onBlur={jest.fn()}
      />
    </Wrapper>
  );
  return { validate, trigger: () => act(() => form.trigger('policyTreeName')) };
}

describe('PolicyTreeNameField', () => {
  it('validates the name the user typed', async () => {
    const { validate, trigger } = setup({ autoSyncActive: false, name: 'imported' });

    expect(await trigger()).toBe(false);
    expect(validate).toHaveBeenCalledWith('imported', expect.anything());
  });

  it('does not validate a leftover name while Auto-sync names the tree', async () => {
    const { validate, trigger } = setup({ autoSyncActive: true, name: 'left-over' });

    expect(await trigger()).toBe(true);
    expect(validate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/prometheus-prod/i)).toBeDisabled();
  });
});
