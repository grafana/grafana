import { HttpResponse, http } from 'msw';
import { FormProvider, useForm } from 'react-hook-form';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../../../../mockApi';
import { getUserDefinedRoutingTree } from '../../../../../mocks/server/entities/k8s/routingtrees';
import { getDefaultFormValues } from '../../../../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../../../../types/rule-form';

import { RoutingSettings } from './RouteSettings';

const server = setupMswServer();

interface HarnessProps {
  groupBy?: string[];
  overrideTimings?: boolean;
}

function Harness({ groupBy = [], overrideTimings = false }: HarnessProps) {
  const form = useForm<RuleFormValues>({
    mode: 'onChange',
    defaultValues: {
      ...getDefaultFormValues(),
      contactPoints: {
        grafana: {
          selectedContactPoint: 'team-receiver',
          overrideGrouping: true,
          groupBy,
          overrideTimings,
          groupWaitValue: '',
          groupIntervalValue: '',
          repeatIntervalValue: '',
          muteTimeIntervals: [],
          activeTimeIntervals: [],
        },
      },
    },
  });
  return (
    <FormProvider {...form}>
      <RoutingSettings alertManager="grafana" />
      <output>{JSON.stringify(form.watch('contactPoints.grafana.groupBy'))}</output>
    </FormProvider>
  );
}

const expectGroupBy = (labels: string[]) =>
  expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify(labels));

describe('RoutingSettings group by', () => {
  it('seeds the required labels when grouping is overridden and nothing is set', () => {
    render(<Harness />);

    expectGroupBy(['grafana_folder', 'alertname']);
  });

  it('replaces everything with the disable marker when Disable is picked', async () => {
    render(<Harness groupBy={['grafana_folder', 'alertname', 'cluster']} />);

    await selectOptionInTest(screen.getByLabelText('Group by'), 'Disable (...)');

    expectGroupBy(['...']);
  });

  it('restores the required labels when the disable marker is removed', async () => {
    const { user } = render(<Harness groupBy={['...']} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expectGroupBy(['grafana_folder', 'alertname']);
  });
});

describe('RoutingSettings timings', () => {
  const ROUTING_TREES_URL = '/apis/notifications.alerting.grafana.app/v1beta1/namespaces/:namespace/routingtrees';

  const timingInputs = () => ({
    groupWait: screen.getByLabelText('Group wait value'),
    groupInterval: screen.getByLabelText('Group interval value'),
    repeatInterval: screen.getByLabelText('Repeat interval value'),
  });

  it('shows the default policy timings as placeholders', async () => {
    const defaultPolicy = getUserDefinedRoutingTree({
      alertmanager_config: {
        route: { receiver: 'grafana-default-email', group_wait: '45s', group_interval: '6m', repeat_interval: '12h' },
      },
      template_files: {},
    });
    server.use(http.get(ROUTING_TREES_URL, () => HttpResponse.json({ items: [defaultPolicy] })));
    render(<Harness overrideTimings />);

    expect(await screen.findByPlaceholderText('45s')).toBe(timingInputs().groupWait);
    expect(screen.getByPlaceholderText('6m')).toBe(timingInputs().groupInterval);
    expect(screen.getByPlaceholderText('12h')).toBe(timingInputs().repeatInterval);
  });

  it('rejects a zero group interval and repeat interval, which the backend rejects too', async () => {
    const { user } = render(<Harness overrideTimings />);

    await user.type(timingInputs().groupInterval, '0s');
    await user.type(timingInputs().repeatInterval, '0s');

    expect(await screen.findAllByText('Must be greater than zero')).toHaveLength(2);
  });

  it('accepts a zero group wait', async () => {
    const { user } = render(<Harness overrideTimings />);

    await user.type(timingInputs().groupWait, '0s');
    await user.tab();

    expect(screen.queryByText(/invalid duration|greater than zero/i)).not.toBeInTheDocument();
  });

  it('rejects milliseconds, which the rules API has no unit for', async () => {
    const { user } = render(<Harness overrideTimings />);

    await user.type(timingInputs().groupWait, '500ms');

    expect(await screen.findByText(/invalid duration format/i)).toBeInTheDocument();
  });

  it('validates each timing on its own', async () => {
    const { user } = render(<Harness overrideTimings />);

    await user.type(timingInputs().groupInterval, '5m');
    await user.type(timingInputs().repeatInterval, '1m');
    await user.tab();

    expect(screen.queryByText(/invalid duration|greater than zero|should be higher/i)).not.toBeInTheDocument();
  });
});
