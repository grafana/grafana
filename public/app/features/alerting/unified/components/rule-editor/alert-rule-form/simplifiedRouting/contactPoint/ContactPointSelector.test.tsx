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

function FormWrapper({ receiver }: { receiver: string }) {
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
      <form onSubmit={form.handleSubmit(jest.fn())}>
        <input aria-label="Rule name" autoFocus />
        <ContactPointSelector alertManager="grafana" />
        <button type="submit">Save</button>
      </form>
    </FormProvider>
  );
}

describe('ContactPointSelector', () => {
  it('focuses the contact point input when saving without a contact point', async () => {
    const { user } = render(<FormWrapper receiver="" />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Contact point is required.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveFocus());
  });

  it('keeps focus on the rule name when background resolution finds a missing contact point', async () => {
    render(<FormWrapper receiver="deleted-contact-point" />);

    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveFocus();
    expect(await screen.findByText('Contact point "deleted-contact-point" could not be found')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveFocus();
  });

  it('highlights the saved contact point when the menu opens', async () => {
    const { user } = render(<FormWrapper receiver="provisioned-contact-point" />);

    await waitFor(async () => {
      await user.click(screen.getByRole('combobox'));
      expect(await screen.findByRole('option', { name: /provisioned-contact-point/ })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  it('reports a saved contact point that no longer exists', async () => {
    render(<FormWrapper receiver="deleted-contact-point" />);

    expect(await screen.findByText('Contact point "deleted-contact-point" could not be found')).toBeInTheDocument();
  });
});
