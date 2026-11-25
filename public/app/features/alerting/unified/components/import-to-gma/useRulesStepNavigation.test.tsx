import { type PropsWithChildren } from 'react';
import { useForm } from 'react-hook-form';
import { act, renderHook } from 'test/test-utils';

import { StepperStateProvider } from './Wizard/StepperState';
import { mockImportFormValues } from './testUtils';
import { type ImportFormValues } from './types';
import { useRulesStepNavigation } from './useRulesStepNavigation';

function Wrapper({ children }: PropsWithChildren) {
  return <StepperStateProvider>{children}</StepperStateProvider>;
}

const completeDataSourceValues: Partial<ImportFormValues> = {
  rulesSource: 'datasource',
  rulesDatasourceUID: 'prometheus-uid',
  rulesDatasourceName: 'Prometheus',
  selectedRoutingTree: 'imported',
  targetDatasourceUID: 'prometheus-uid',
};

const completeYamlValues: Partial<ImportFormValues> = {
  rulesSource: 'yaml',
  rulesYamlFile: new File([''], 'rules.yaml'),
  yamlImportTargetDatasourceUID: 'yaml-target-uid',
  selectedRoutingTree: 'imported',
  targetDatasourceUID: 'prometheus-uid',
};

function setup({ formValues = {}, fileError }: { formValues?: Partial<ImportFormValues>; fileError?: string } = {}) {
  const validate = jest.fn(async () => fileError ?? true);
  const { result } = renderHook(
    () => {
      const form = useForm<ImportFormValues>({ defaultValues: mockImportFormValues(formValues) });
      form.register('rulesYamlFile', { validate });
      return { form, navigation: useRulesStepNavigation(form) };
    },
    { wrapper: Wrapper }
  );
  return { result, validate };
}

async function clickNext(result: ReturnType<typeof setup>['result']) {
  let proceed: boolean | undefined;
  await act(async () => {
    proceed = await result.current.navigation.onNext();
  });
  return proceed;
}

describe('useRulesStepNavigation', () => {
  it('waits for the check of the YAML file and does not proceed when it fails', async () => {
    const { result, validate } = setup({ formValues: completeYamlValues, fileError: 'No rules found in this file' });

    const proceed = await clickNext(result);

    expect(validate).toHaveBeenCalled();
    expect(proceed).toBe(false);
    expect(result.current.form.getValues('step2Completed')).toBe(false);
    expect(result.current.navigation.rulesSpec).toBeUndefined();
  });

  it('completes the step and keeps what it imports when the YAML file passes the check', async () => {
    const { result } = setup({ formValues: completeYamlValues });

    const proceed = await clickNext(result);

    expect(proceed).toBe(true);
    expect(result.current.form.getValues('step2Completed')).toBe(true);
    expect(result.current.form.getValues('step2Skipped')).toBe(false);
    expect(result.current.navigation.rulesSpec).toMatchObject({
      type: 'yaml',
      datasource: { uid: 'yaml-target-uid' },
    });
  });

  it('does not check a YAML file when the rules come from a data source', async () => {
    const { result, validate } = setup({ formValues: completeDataSourceValues });

    await clickNext(result);

    expect(validate).not.toHaveBeenCalled();
    expect(result.current.navigation.rulesSpec).toMatchObject({
      type: 'datasource',
      datasource: { uid: 'prometheus-uid' },
    });
  });

  it('does not proceed while the form is incomplete', async () => {
    const { result } = setup({ formValues: { ...completeDataSourceValues, selectedRoutingTree: '' } });

    const proceed = await clickNext(result);

    expect(proceed).toBe(false);
    expect(result.current.form.getValues('step2Completed')).toBe(false);
    expect(result.current.navigation.rulesSpec).toBeUndefined();
  });

  it('has nothing to import before Next', () => {
    const { result } = setup({ formValues: completeDataSourceValues });

    expect(result.current.navigation.rulesSpec).toBeUndefined();
  });

  it('drops what it imports and un-completes the step when a value is edited after Next', async () => {
    const { result } = setup({ formValues: completeDataSourceValues });
    await clickNext(result);

    act(() => result.current.form.setValue('targetDatasourceUID', 'other-uid'));

    expect(result.current.navigation.rulesSpec).toBeUndefined();
    expect(result.current.form.getValues('step2Completed')).toBe(false);
  });

  it('keeps what it imports when a value is set to an equal copy, as watching an object field returns', async () => {
    const folder = { uid: 'folder-uid', title: 'Folder' };
    const { result } = setup({ formValues: { ...completeDataSourceValues, targetFolder: folder } });
    await clickNext(result);

    act(() => result.current.form.setValue('targetFolder', { ...folder }));

    expect(result.current.navigation.rulesSpec).toMatchObject({ targetFolder: folder });
    expect(result.current.form.getValues('step2Completed')).toBe(true);
  });

  it('forgets what it imports when the step is skipped', async () => {
    const { result } = setup({ formValues: completeDataSourceValues });
    await clickNext(result);

    act(() => result.current.navigation.onSkip());

    expect(result.current.navigation.rulesSpec).toBeUndefined();
    expect(result.current.form.getValues('step2Skipped')).toBe(true);
  });
});
