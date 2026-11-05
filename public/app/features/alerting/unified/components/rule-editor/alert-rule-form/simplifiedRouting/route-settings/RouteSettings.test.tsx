import { FormProvider, useForm } from 'react-hook-form';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';

import { getDefaultFormValues } from '../../../../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../../../../types/rule-form';

import { RoutingSettings } from './RouteSettings';

function FormWrapper({
  groupBy = [],
  overrideGrouping = true,
  overrideTimings = false,
}: {
  groupBy?: string[];
  overrideGrouping?: boolean;
  overrideTimings?: boolean;
}) {
  const form = useForm<RuleFormValues>({
    defaultValues: {
      ...getDefaultFormValues(),
      contactPoints: {
        grafana: {
          selectedContactPoint: 'team-receiver',
          overrideGrouping,
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
    render(<FormWrapper />);

    expectGroupBy(['grafana_folder', 'alertname']);
  });

  it('replaces everything with the disable marker when Disable is picked', async () => {
    render(<FormWrapper groupBy={['grafana_folder', 'alertname', 'cluster']} />);

    await selectOptionInTest(screen.getByLabelText('Group by'), 'Disable (...)');

    expectGroupBy(['...']);
  });

  it('restores the required labels when the disable marker is removed', async () => {
    const { user } = render(<FormWrapper groupBy={['...']} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expectGroupBy(['grafana_folder', 'alertname']);
  });
});

describe('RoutingSettings overrides', () => {
  it('shows the group by field once grouping is overridden', async () => {
    const { user } = render(<FormWrapper overrideGrouping={false} />);

    await user.click(screen.getByLabelText('Override grouping'));

    expect(await screen.findByLabelText('Group by')).toBeInTheDocument();
  });

  it('keeps the picked group by when grouping override is turned off and on again', async () => {
    const { user } = render(<FormWrapper overrideGrouping={false} />);
    await user.click(screen.getByLabelText('Override grouping'));
    await selectOptionInTest(await screen.findByLabelText('Group by'), 'Disable (...)');

    await user.click(screen.getByLabelText('Override grouping'));
    await user.click(screen.getByLabelText('Override grouping'));

    expectGroupBy(['...']);
  });

  it('shows the timing fields once timings are overridden', async () => {
    const { user } = render(<FormWrapper />);

    await user.click(screen.getByLabelText('Override timings'));

    expect(await screen.findByLabelText(/group wait/i)).toBeInTheDocument();
  });
});
