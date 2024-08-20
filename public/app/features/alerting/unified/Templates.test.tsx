import * as React from 'react';
import { Props } from 'react-virtualized-auto-sizer';
import { render, screen, within } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { config } from '@grafana/runtime';
import { CodeEditorProps } from '@grafana/ui/src/components/Monaco/types';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AccessControlAction } from 'app/types';

import Templates from './Templates';
import { grantUserPermissions } from './mocks';

jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
  AppChromeUpdate: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
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
  codeEditor: byTestId('code-editor'),
};

setupMswServer();

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
});

describe('Templates routes', () => {
  it('allows duplication of template with spaces in name', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/template%20with%20spaces/duplicate?alertmanager=grafana'],
      },
    });

    expect(await screen.findByText('Edit payload')).toBeInTheDocument();
  });

  it('allows editing of template with spaces in name', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/template%20with%20spaces/edit?alertmanager=grafana'],
      },
    });

    expect(await screen.findByText('Edit payload')).toBeInTheDocument();
  });

  it('renders empty template form', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/new'],
      },
    });

    const form = await ui.templateForm.find();

    expect(form).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Template name/ })).toHaveValue('');
  });
});

describe('Templates K8s API', () => {
  beforeAll(() => {
    config.featureToggles.alertingApiServer = true;
  });

  afterAll(() => {
    config.featureToggles.alertingApiServer = false;
  });

  it('form edit renders with correct form values', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/k8s-custom-email-uid/edit?alertmanager=grafana'],
      },
    });

    const form = await ui.templateForm.find();

    expect(form).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Template name/ })).toHaveValue('custom-email');
    expect(within(form).getAllByTestId('code-editor')[0]).toHaveValue(
      "{{ define 'custom-email' }}  Custom email template {{ end }}"
    );
  });

  it('renders duplicate template form with correct values', async () => {
    render(<Templates />, {
      historyOptions: {
        initialEntries: ['/alerting/notifications/templates/k8s-custom-email-uid/duplicate?alertmanager=grafana'],
      },
    });

    const form = await ui.templateForm.find();

    expect(form).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Template name/ })).toHaveValue('custom-email (copy)');
    expect(within(form).getAllByTestId('code-editor')[0]).toHaveValue(
      "{{ define 'custom-email' }}  Custom email template {{ end }}"
    );
  });
});
