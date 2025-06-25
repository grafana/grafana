import { InitialEntry } from 'history/createMemoryHistory';
import * as React from 'react';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { Props } from 'react-virtualized-auto-sizer';
import { render, screen, waitFor, within } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { CodeEditor } from '@grafana/ui';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AccessControlAction } from 'app/types';

import Templates from './Templates';
import { grantUserPermissions } from './mocks';

type CodeEditorProps = React.ComponentProps<typeof CodeEditor>;

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));

//mock updateDefinesWithUniqueValue
jest.mock('app/features/alerting/unified/utils/templates', () => ({
  ...jest.requireActual('app/features/alerting/unified/utils/templates'),
  updateDefinesWithUniqueValue: (templateContent: string) => {
    return templateContent.replace(/custom-email/g, 'custom-email_NEW');
  },
}));

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: Props) =>
      children({ width: 1000, height: 1000, scaledWidth: 1, scaledHeight: 1 })
);

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value, onChange }: CodeEditorProps) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

const ui = {
  templateForm: byRole('form', { name: 'Template form' }),
  form: {
    title: byLabelText(/Template group name/),
    saveButton: byRole('button', { name: 'Save' }),
  },
};

const navUrl = {
  edit: (name: string) => `/alerting/notifications/templates/${name}/edit?alertmanager=grafana`,
  duplicate: (name: string) => `/alerting/notifications/templates/${name}/duplicate?alertmanager=grafana`,
  new: `/alerting/notifications/templates/new`,
};

setupMswServer();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
});

const setup = (initialEntries: InitialEntry[]) => {
  return render(
    <>
      <AppNotificationList />
      <Routes>
        <Route path="/alerting/notifications/templates/*" element={<Templates />} />
      </Routes>
    </>,
    {
      historyOptions: { initialEntries },
    }
  );
};

const slackTemplate = 'k8s-template%20with%20spaces-resource-name';
const emailTemplate = 'k8s-custom-email-resource-name';

describe('Templates routes', () => {
  it('allows duplication of template with spaces in name', async () => {
    setup([navUrl.duplicate(slackTemplate)]);

    expect(await screen.findByText('Edit payload')).toBeInTheDocument();
  });

  it('allows editing of template with spaces in name', async () => {
    setup([navUrl.edit(slackTemplate)]);

    expect(await screen.findByText('Edit payload')).toBeInTheDocument();
  });

  it('renders empty template form', async () => {
    setup([navUrl.new]);

    const form = await ui.templateForm.find();

    expect(form).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Template group name/ })).toHaveValue('');
  });

  it('should pass name validation when editing existing template', async () => {
    const { user } = setup([navUrl.edit(emailTemplate)]);

    const titleElement = await ui.form.title.find();
    await waitFor(() => {
      expect(titleElement).toHaveValue('custom-email');
    });

    await user.click(ui.form.saveButton.get());

    // No error message should be displayed for a unique name
    expect(screen.queryByText('Another template with this name already exists')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Template saved')).toBeInTheDocument();
    });
  });

  it('form edit renders with correct form values', async () => {
    setup([navUrl.edit('k8s-custom-email-resource-name')]);

    const form = await ui.templateForm.find();

    expect(form).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Template group name/ })).toHaveValue('custom-email');
    expect(within(form).getAllByTestId('code-editor')[0]).toHaveValue(
      '{{ define "custom-email" }}  Custom email template {{ end }}'
    );
  });

  it('renders duplicate template form with correct values', async () => {
    setup([navUrl.duplicate('k8s-custom-email-resource-name')]);

    const form = await ui.templateForm.find();

    expect(form).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Template group name/ })).toHaveValue('custom-email (copy)');
    expect(within(form).getAllByTestId('code-editor')[0]).toHaveTextContent(
      '{{ define "custom-email_NEW" }} Custom email template {{ end }}'
    );
  });

  it('updates a template', async () => {
    const { user } = setup([navUrl.edit('k8s-custom-email-resource-name')]);

    const form = await ui.templateForm.find();

    const templateEditor = within(form).getAllByTestId('code-editor')[0];

    await user.clear(templateEditor);
    await user.type(templateEditor, '{{ define "custom-email" }}Updated custom email template{{ end }}');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status', { name: 'Template saved' })).toHaveTextContent(
      'Template custom-email has been saved'
    );

    expect(ui.templateForm.query()).not.toBeInTheDocument();
  });
});
