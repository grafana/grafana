import { useForm } from 'react-hook-form';
import { act, renderHook } from 'test/test-utils';

import { mockImportFormValues } from './testUtils';
import { type ImportFormValues } from './types';
import { useRulesStepNavigation } from './useRulesStepNavigation';

function setup({ formValues = {}, fileError }: { formValues?: Partial<ImportFormValues>; fileError?: string } = {}) {
  const validate = jest.fn(async () => fileError ?? true);
  const { result } = renderHook(() => {
    const form = useForm<ImportFormValues>({ defaultValues: mockImportFormValues(formValues) });
    form.register('rulesYamlFile', { validate });
    return { form, navigation: useRulesStepNavigation(form) };
  });
  return { result, validate };
}

describe('useRulesStepNavigation', () => {
  it('waits for the check of the YAML file and does not proceed when it fails', async () => {
    const { result, validate } = setup({
      formValues: { rulesSource: 'yaml', rulesYamlFile: new File([''], 'rules.yaml') },
      fileError: 'No rules found in this file',
    });

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.navigation.onNext();
    });

    expect(validate).toHaveBeenCalled();
    expect(proceed).toBe(false);
    expect(result.current.form.getValues('step2Completed')).toBe(false);
  });

  it('completes the step when the YAML file passes the check', async () => {
    const { result } = setup({
      formValues: { rulesSource: 'yaml', rulesYamlFile: new File([''], 'rules.yaml') },
    });

    let proceed: boolean | undefined;
    await act(async () => {
      proceed = await result.current.navigation.onNext();
    });

    expect(proceed).toBe(true);
    expect(result.current.form.getValues('step2Completed')).toBe(true);
    expect(result.current.form.getValues('step2Skipped')).toBe(false);
  });

  it('does not check a YAML file when the rules come from a data source', async () => {
    const { result, validate } = setup({ formValues: { rulesSource: 'datasource' } });

    await act(async () => {
      await result.current.navigation.onNext();
    });

    expect(validate).not.toHaveBeenCalled();
  });
});
