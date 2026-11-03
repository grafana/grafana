import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { getDefaultFormValues } from 'app/features/alerting/unified/rule-editor/formDefaults';
import { type RuleFormValues } from 'app/features/alerting/unified/types/rule-form';

import { ContactPointSelector } from './ContactPointSelector';

setupMswServer();

beforeEach(() => {
  mockComboboxRect();
});

function Harness({ receiver }: { receiver: string }) {
  const form = useForm<RuleFormValues>({
    defaultValues: {
      ...getDefaultFormValues(),
      contactPoints: {
        grafana: {
          selectedContactPoint: receiver,
          overrideGrouping: false,
          groupBy: [],
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
      <ContactPointSelector alertManager="grafana" />
    </FormProvider>
  );
}

describe('ContactPointSelector', () => {
  it('highlights the saved contact point when the menu opens', async () => {
    const { user } = render(<Harness receiver="provisioned-contact-point" />);

    await waitFor(async () => {
      await user.click(screen.getByRole('combobox'));
      expect(await screen.findByRole('option', { name: /provisioned-contact-point/ })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  it('reports a saved contact point that no longer exists', async () => {
    render(<Harness receiver="deleted-contact-point" />);

    expect(await screen.findByText('Contact point "deleted-contact-point" could not be found')).toBeInTheDocument();
  });
});
