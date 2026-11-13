import { HttpResponse, delay, http } from 'msw';
import { type PropsWithChildren } from 'react';
import { useForm } from 'react-hook-form';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';

import { setupMswServer } from '../../mockApi';
import { convertResponse } from '../../mocks/convertApi';

import { StepperStateProvider, useStepperState } from './Wizard/StepperState';
import { StepKey } from './Wizard/types';
import { mockImportFormValues } from './testUtils';
import { type ImportFormValues } from './types';
import { useStep1DryRun } from './useStep1DryRun';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const server = setupMswServer();
const CONVERT_URL = '/api/convert/api/v1/alerts';

const yamlFile = () => new File(['route:\n  receiver: default\nreceivers:\n  - name: default\n'], 'am.yaml');

const StoreWrapper = getWrapper({ renderWithRouter: true });
function Wrapper({ children }: PropsWithChildren) {
  return (
    <StoreWrapper>
      <StepperStateProvider>{children}</StepperStateProvider>
    </StoreWrapper>
  );
}

function setup(formValues: Partial<ImportFormValues> = {}) {
  return renderHook(
    () => {
      const form = useForm<ImportFormValues>({ defaultValues: mockImportFormValues(formValues) });
      const dryRun = useStep1DryRun(form);
      const { hasStepErrors } = useStepperState();
      return { form, dryRun, hasStepErrors };
    },
    { wrapper: Wrapper }
  );
}

// checkNow also points the live preview at what it checks; wait for that request so none outlives the test.
async function check(result: ReturnType<typeof setup>['result']) {
  let passed: boolean | undefined;
  await act(async () => {
    passed = await result.current.dryRun.checkNow(result.current.dryRun.liveStep1Values);
  });
  await waitFor(() => expect(result.current.dryRun.dryRunState).not.toBe('loading'));
  return passed;
}

function countDryRuns() {
  const counter = { count: 0 };
  server.use(
    http.post(CONVERT_URL, () => {
      counter.count += 1;
      return HttpResponse.json(convertResponse());
    })
  );
  return counter;
}

beforeEach(() => {
  jest.mocked(reportInteraction).mockClear();
  // The debounced preview can still fire after a test's own handler is gone.
  server.use(http.post(CONVERT_URL, () => HttpResponse.json(convertResponse())));
});

describe('useStep1DryRun', () => {
  describe('checkNow', () => {
    it('passes without a request when there is nothing to validate yet', async () => {
      const dryRuns = countDryRuns();
      const { result } = setup();

      const passed = await check(result);

      expect(passed).toBe(true);
      expect(dryRuns.count).toBe(0);
      expect(reportInteraction).not.toHaveBeenCalled();
    });

    it('passes and reports success for a valid configuration', async () => {
      const dryRuns = countDryRuns();
      const { result } = setup({ notificationsYamlFile: yamlFile() });

      const passed = await check(result);

      expect(passed).toBe(true);
      expect(dryRuns.count).toBe(1);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_success');
    });

    it('passes and reports the renamed resources when the check renames some', async () => {
      server.use(
        http.post(CONVERT_URL, () =>
          HttpResponse.json(
            convertResponse({
              rename_resources: { receivers: { a: 'a-1' }, time_intervals: { b: 'b-1', c: 'c-1' } },
            })
          )
        )
      );
      const { result } = setup({ notificationsYamlFile: yamlFile() });

      const passed = await check(result);

      expect(passed).toBe(true);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_warning', {
        renamedReceiversCount: 1,
        renamedTimeIntervalsCount: 2,
      });
    });

    it('fails and reports an error when the answer is not a success', async () => {
      server.use(
        http.post(CONVERT_URL, () =>
          HttpResponse.json(convertResponse({ status: 'error', error: 'template conflict', errorType: 'bad_data' }))
        )
      );
      const { result } = setup({ notificationsYamlFile: yamlFile() });

      const passed = await check(result);

      expect(passed).toBe(false);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_error');
    });

    it('fails and reports an error when the request itself fails', async () => {
      server.use(http.post(CONVERT_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
      const { result } = setup({ notificationsYamlFile: yamlFile() });

      const passed = await check(result);

      expect(passed).toBe(false);
      expect(reportInteraction).toHaveBeenCalledWith('grafana_alerting_import_to_gma_dryrun_error');
    });

    it('reports it is checking while the request runs, and stops afterwards', async () => {
      server.use(
        http.post(CONVERT_URL, async () => {
          await delay(150);
          return HttpResponse.json(convertResponse());
        })
      );
      const { result } = setup({ notificationsYamlFile: yamlFile() });
      expect(result.current.dryRun.isChecking).toBe(false);

      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.dryRun.checkNow(result.current.dryRun.liveStep1Values);
      });
      await waitFor(() => expect(result.current.dryRun.isChecking).toBe(true));

      await act(async () => {
        await pending;
      });
      expect(result.current.dryRun.isChecking).toBe(false);
    });
  });

  describe('live preview', () => {
    it('stays idle until a configuration is chosen', () => {
      const dryRuns = countDryRuns();
      const { result } = setup();

      expect(result.current.dryRun.dryRunState).toBe('idle');
      expect(result.current.dryRun.dryRunResult).toBeUndefined();
      expect(dryRuns.count).toBe(0);
    });

    it('validates a chosen configuration after the debounce and clears the step error', async () => {
      countDryRuns();
      const { result } = setup({ notificationsYamlFile: yamlFile() });

      await waitFor(() => expect(result.current.dryRun.dryRunState).toBe('success'), { timeout: 3000 });
      expect(result.current.dryRun.dryRunResult?.valid).toBe(true);
      expect(result.current.hasStepErrors(StepKey.Notifications)).toBe(false);
    });

    it('marks the notifications step as failing when the configuration is rejected', async () => {
      server.use(
        http.post(CONVERT_URL, () =>
          HttpResponse.json(convertResponse({ status: 'error', error: 'bad config', errorType: 'bad_data' }))
        )
      );
      const { result } = setup({ notificationsYamlFile: yamlFile() });

      await waitFor(() => expect(result.current.dryRun.dryRunState).toBe('error'), { timeout: 3000 });
      expect(result.current.hasStepErrors(StepKey.Notifications)).toBe(true);
    });
  });
});
