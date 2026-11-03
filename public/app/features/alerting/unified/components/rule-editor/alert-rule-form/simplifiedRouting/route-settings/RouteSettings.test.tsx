import { FormProvider, useForm } from 'react-hook-form';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';

import { getDefaultFormValues } from '../../../../../rule-editor/formDefaults';
import { type RuleFormValues } from '../../../../../types/rule-form';

import { RoutingSettings } from './RouteSettings';

function Harness({ groupBy = [] }: { groupBy?: string[] }) {
  const form = useForm<RuleFormValues>({
    defaultValues: {
      ...getDefaultFormValues(),
      contactPoints: {
        grafana: {
          selectedContactPoint: 'team-receiver',
          overrideGrouping: true,
          groupBy,
          overrideTimings: false,
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
