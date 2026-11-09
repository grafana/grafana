import { type PropsWithChildren, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { act, renderHook } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';

import { StepperStateProvider } from './Wizard/StepperState';
import { mockImportFormValues } from './testUtils';
import { type ImportFormValues, type Step1Values } from './types';
import { useStep1Handlers } from './useStep1Handlers';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

function Wrapper({ children }: PropsWithChildren) {
  return <StepperStateProvider>{children}</StepperStateProvider>;
}

function setup({
  formValues = {},
  nameError,
  checkPasses = true,
}: {
  formValues?: Partial<ImportFormValues>;
  nameError?: string;
  checkPasses?: boolean;
} = {}) {
  const checkNow = jest.fn().mockResolvedValue(checkPasses);
  const { result, rerender } = renderHook(
    ({ autoSyncIdentifier }: { autoSyncIdentifier?: string }) => {
      const form = useForm<ImportFormValues>({ defaultValues: mockImportFormValues(formValues) });
      form.register('policyTreeName', { validate: () => nameError ?? true });
      // Derived from the form the way the wizard does it, so the values are what the user has typed so far.
      const [
        notificationsSource,
        policyTreeName,
        notificationsDatasourceUID,
        notificationsDatasourceName,
        notificationsYamlFile,
        notificationsTemplateFiles,
        autoSyncNotificationsEnabled,
      ] = form.watch([
        'notificationsSource',
        'policyTreeName',
        'notificationsDatasourceUID',
        'notificationsDatasourceName',
        'notificationsYamlFile',
        'notificationsTemplateFiles',
        'autoSyncNotificationsEnabled',
      ]);
      const liveStep1Values: Step1Values = useMemo(
        () => ({
          notificationsSource,
          policyTreeName,
          notificationsDatasourceUID,
          notificationsDatasourceName,
          notificationsYamlFile,
          notificationsTemplateFiles,
          autoSyncNotificationsEnabled,
        }),
        [
          notificationsSource,
          policyTreeName,
          notificationsDatasourceUID,
          notificationsDatasourceName,
          notificationsYamlFile,
          notificationsTemplateFiles,
          autoSyncNotificationsEnabled,
        ]
      );
      const handlers = useStep1Handlers(form, { liveStep1Values, autoSyncIdentifier, checkNow });
      return { form, handlers };
    },
    { wrapper: Wrapper, initialProps: { autoSyncIdentifier: undefined as string | undefined } }
  );
  return { result, rerender, checkNow };
}

beforeEach(() => {
  jest.mocked(reportInteraction).mockClear();
});

describe('useStep1Handlers', () => {
  describe('onNext', () => {
    it('completes the step, keeps what was validated, and fills the rules step with the new tree', async () => {
      const { result, checkNow } = setup({ formValues: { policyTreeName: 'imported' } });

      let proceeded: boolean | undefined;
      await act(async () => {
        proceeded = await result.current.handlers.onNext();
      });

      expect(proceeded).toBe(true);
      expect(checkNow).toHaveBeenCalledWith(expect.objectContaining({ policyTreeName: 'imported' }));
      expect(result.current.form.getValues('step1Completed')).toBe(true);
      expect(result.current.form.getValues('step1Skipped')).toBe(false);
      expect(result.current.form.getValues('selectedRoutingTree')).toBe('imported');
      expect(result.current.handlers.step1Snapshot).toEqual(expect.objectContaining({ policyTreeName: 'imported' }));
    });

    it('stays on the step, without completing it, when the name check fails', async () => {
      const { result, checkNow } = setup({ nameError: 'taken' });

      let proceeded: boolean | undefined;
      await act(async () => {
        proceeded = await result.current.handlers.onNext();
      });

      expect(proceeded).toBe(false);
      expect(checkNow).not.toHaveBeenCalled();
      expect(result.current.form.getValues('step1Completed')).toBe(false);
      expect(result.current.handlers.step1Snapshot).toBeUndefined();
    });

    it('stays on the step, without completing it, when the dry run fails', async () => {
      const { result } = setup({ checkPasses: false, formValues: { policyTreeName: 'imported' } });

      let proceeded: boolean | undefined;
      await act(async () => {
        proceeded = await result.current.handlers.onNext();
      });

      expect(proceeded).toBe(false);
      expect(result.current.form.getValues('step1Completed')).toBe(false);
      expect(result.current.form.getValues('selectedRoutingTree')).toBe('');
    });

    it('replaces a tree it filled in earlier, but keeps one picked on the rules step', async () => {
      const { result } = setup({ formValues: { policyTreeName: 'first' } });
      await act(async () => {
        await result.current.handlers.onNext();
      });
      expect(result.current.form.getValues('selectedRoutingTree')).toBe('first');

      act(() => result.current.form.setValue('policyTreeName', 'second'));
      await act(async () => {
        await result.current.handlers.onNext();
      });
      expect(result.current.form.getValues('selectedRoutingTree')).toBe('second');

      act(() => {
        result.current.form.setValue('selectedRoutingTree', 'picked-by-user');
        result.current.form.setValue('policyTreeName', 'third');
      });
      await act(async () => {
        await result.current.handlers.onNext();
      });
      expect(result.current.form.getValues('selectedRoutingTree')).toBe('picked-by-user');
    });

    it('fills in the name the sync will pick for Auto-sync, not a name typed earlier', async () => {
      const { result, rerender } = setup({
        formValues: {
          policyTreeName: 'typed-before',
          notificationsSource: 'datasource',
          notificationsDatasourceUID: 'mimir-uid',
          autoSyncNotificationsEnabled: true,
        },
      });
      rerender({ autoSyncIdentifier: 'mimir-sync' });

      await act(async () => {
        await result.current.handlers.onNext();
      });

      expect(result.current.form.getValues('selectedRoutingTree')).toBe('mimir-sync');
    });
  });

  describe('onSkip', () => {
    it('marks the step skipped, drops the tree it filled in, and reports the skip', async () => {
      const { result } = setup({ formValues: { policyTreeName: 'imported' } });
      await act(async () => {
        await result.current.handlers.onNext();
      });

      act(() => result.current.handlers.onSkip());

      expect(result.current.form.getValues('step1Completed')).toBe(false);
      expect(result.current.form.getValues('step1Skipped')).toBe(true);
      expect(result.current.form.getValues('selectedRoutingTree')).toBe('');
      expect(result.current.handlers.step1Snapshot).toBeUndefined();
      expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_wizard_step_skipped', {
        step: 'notifications',
      });
    });
  });

  describe('onContinueWhileLocked', () => {
    it('moves on without completing or skipping the step', () => {
      const { result } = setup({ formValues: { step1Completed: true, selectedRoutingTree: 'imported' } });

      let proceeded: boolean | undefined;
      act(() => {
        proceeded = result.current.handlers.onContinueWhileLocked();
      });

      expect(proceeded).toBe(true);
      expect(result.current.form.getValues('step1Completed')).toBe(false);
      expect(result.current.form.getValues('step1Skipped')).toBe(false);
      expect(result.current.form.getValues('selectedRoutingTree')).toBe('');
    });
  });

  describe('editing after Next', () => {
    it('un-completes the step so the stepper cannot jump ahead on values that were never validated', async () => {
      const { result } = setup({ formValues: { policyTreeName: 'imported' } });
      await act(async () => {
        await result.current.handlers.onNext();
      });
      expect(result.current.form.getValues('step1Completed')).toBe(true);

      act(() => result.current.form.setValue('policyTreeName', 'edited'));

      expect(result.current.form.getValues('step1Completed')).toBe(false);
      expect(result.current.handlers.step1Snapshot).toBeUndefined();
    });

    it('does not complete the step again when the original values are typed back', async () => {
      const { result } = setup({ formValues: { policyTreeName: 'imported' } });
      await act(async () => {
        await result.current.handlers.onNext();
      });
      act(() => result.current.form.setValue('policyTreeName', 'edited'));
      act(() => result.current.form.setValue('policyTreeName', 'imported'));

      // The edit un-completed the step, and undoing it does not undo that: Next has to be pressed again.
      expect(result.current.form.getValues('step1Completed')).toBe(false);
    });

    it('keeps the step completed while the live values still match the validated ones', async () => {
      const { result, rerender } = setup({ formValues: { policyTreeName: 'imported' } });
      await act(async () => {
        await result.current.handlers.onNext();
      });

      rerender({ autoSyncIdentifier: undefined });

      expect(result.current.form.getValues('step1Completed')).toBe(true);
      expect(result.current.handlers.step1Snapshot).toBeDefined();
    });
  });
});
