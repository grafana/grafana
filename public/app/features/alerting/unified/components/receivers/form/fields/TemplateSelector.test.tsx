import { ComponentProps, ReactNode } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { CodeEditor } from '@grafana/ui';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { getAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import {
  addTemplateToDb,
  resetTemplatesDb,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/templates.k8s';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { NotificationChannelOption } from 'app/features/alerting/unified/types/alerting';
import { KnownProvenance } from 'app/features/alerting/unified/types/knownProvenance';
import { TemplateKind } from 'app/features/alerting/unified/types/notification-template';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { DEFAULT_TEMPLATES } from 'app/features/alerting/unified/utils/template-constants';
import { AccessControlAction } from 'app/types/accessControl';

import { TemplateSelector, TemplatesPicker, getTemplateOptions } from './TemplateSelector';
import { parseTemplates } from './utils';

type CodeEditorProps = ComponentProps<typeof CodeEditor>;

const alertmanagerConfigMock = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: ({ value, onChange }: CodeEditorProps) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

const renderWithProvider = (children: ReactNode) =>
  render(
    <AlertmanagerProvider accessType="notification" alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
      {children}
    </AlertmanagerProvider>
  );

setupMswServer();
describe('getTemplateOptions function', () => {
  it('should return the last template when there are duplicates', () => {
    const rawTemplates = {
      file1:
        '{{ define "template1" }}{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s){{ end }}',
      // duplicated define, the last one should be returned
      file2:
        '{{ define "template1" }}{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s) this is the last one{{ end }}',
      file3:
        '{{ define "email.subject" }}{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s){{ end }}',
      // define with a minus sign
      file4: '{{ define "template_with_minus" -}}{{ .Annotations.summary }}{{- end }}',
      file5: '',
      //nested templates
      file6: `{{ define "nested" }}
      Main Template Content
      {{ template "sub1" }}
      {{ template "sub2" }}
      {{ end }}

      {{ define "sub1" }}
      Sub Template 1 Content
      {{ end }}

      {{ define "sub2" }}
      Sub Template 2 Content
      {{ end }}`,
    };

    const templateFiles = Object.entries(rawTemplates).map(([title, content]) => {
      return {
        uid: title,
        title,
        content,
        provenance: KnownProvenance.None,
        kind: TemplateKind.Grafana,
      };
    });
    const defaultTemplates = parseTemplates(DEFAULT_TEMPLATES);
    const result = getTemplateOptions(templateFiles, defaultTemplates);

    const template1Matches = result.filter((option) => option.label === 'template1');
    expect(template1Matches).toHaveLength(1);
    expect(template1Matches[0].value?.content).toMatch(/this is the last one/i);

    const file5Matches = result.filter((option) => option.label === 'file5');
    expect(file5Matches).toHaveLength(0);

    expect(result).toMatchSnapshot();
  });

  it('processes templates with kind field correctly', () => {
    const templateFiles = [
      {
        uid: 'grafana-template',
        title: 'grafana-template',
        content: '{{ define "grafana-template" }} Grafana content {{ end }}',
        provenance: KnownProvenance.None,
        kind: TemplateKind.Grafana,
      },
      {
        uid: 'mimir-template',
        title: 'mimir-template',
        content: '{{ define "mimir-template" }} Mimir content {{ end }}',
        provenance: KnownProvenance.None,
        kind: TemplateKind.Mimir,
      },
    ];

    const defaultTemplates = parseTemplates(DEFAULT_TEMPLATES);
    const result = getTemplateOptions(templateFiles, defaultTemplates);

    const grafanaMatch = result.find((option) => option.label === 'grafana-template');
    const mimirMatch = result.find((option) => option.label === 'mimir-template');

    expect(grafanaMatch).toBeDefined();
    expect(mimirMatch).toBeDefined();
  });
});

describe('TemplatesPicker', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsExternalRead,
    ]);
    // Reset templates to default state before each test
    resetTemplatesDb();
  });

  it('allows selection of templates', async () => {
    const onSelect = jest.fn();
    const mockOption = { label: 'title' } as NotificationChannelOption;
    const { user } = renderWithProvider(<TemplatesPicker onSelect={onSelect} option={mockOption} valueInForm="" />);
    await user.click(await screen.findByText(/edit title/i));
    const input = await screen.findByRole('combobox');
    expect(screen.queryByText('slack-template')).not.toBeInTheDocument();
    await userEvent.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(Object.keys(alertmanagerConfigMock.template_files).length + 3); // 4 templates in mock plus 3 in the default template
    const template = screen.getByRole('option', { name: 'slack-template' });
    await userEvent.click(template);
    expect(screen.getByText('slack-template')).toBeInTheDocument();
  });

  it('filters out Mimir templates when filterKind is grafana', async () => {
    addTemplateToDb(
      'mimir-template',
      '{{ define "mimir-template" }} Mimir template content {{ end }}',
      TemplateKind.Mimir
    );

    const onSelect = jest.fn();
    const mockOption = { label: 'title' } as NotificationChannelOption;

    const { user } = renderWithProvider(<TemplatesPicker onSelect={onSelect} option={mockOption} valueInForm="" />);

    await user.click(await screen.findByText(/edit title/i));

    const input = await screen.findByRole('combobox');
    await userEvent.click(input);

    expect(screen.queryByRole('option', { name: 'mimir-template' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'slack-template' })).toBeInTheDocument();
  });

  it('shows all templates when filterKind is not specified', async () => {
    addTemplateToDb(
      'mimir-template',
      '{{ define "mimir-template" }} Mimir template content {{ end }}',
      TemplateKind.Mimir
    );

    const onSelect = jest.fn();
    const mockOption = { label: 'title' } as NotificationChannelOption;

    // Render TemplateSelector directly without the TemplatesPicker wrapper
    // to test the filterKind prop behavior in isolation
    renderWithProvider(<TemplateSelector onSelect={onSelect} onClose={jest.fn()} option={mockOption} valueInForm="" />);

    const input = await screen.findByRole('combobox');
    await userEvent.click(input);

    expect(screen.getByRole('option', { name: 'slack-template' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'mimir-template' })).toBeInTheDocument();
  });
});
