import { ReactNode } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { CodeEditorProps } from '@grafana/ui/src/components/Monaco/types';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { getAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { testWithFeatureToggles } from 'app/features/alerting/unified/test/test-utils';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { PROVENANCE_NONE } from 'app/features/alerting/unified/utils/k8s/constants';
import { DEFAULT_TEMPLATES } from 'app/features/alerting/unified/utils/template-constants';
import { AccessControlAction, NotificationChannelOption } from 'app/types';

import { TemplatesPicker, getTemplateOptions } from './TemplateSelector';
import { parseTemplates } from './utils';

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
        provenance: PROVENANCE_NONE,
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
});

describe('TemplatesPicker', () => {
  testWithFeatureToggles(['alertingApiServer']);

  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsExternalRead,
    ]);
  });

  it('allows selection of templates', async () => {
    const onSelect = jest.fn();
    const mockOption = { label: 'title' } as NotificationChannelOption;
    const { user } = renderWithProvider(<TemplatesPicker onSelect={onSelect} option={mockOption} valueInForm="" />);
    await user.click(await screen.findByText(/edit title/i));
    const input = screen.getByRole('combobox');
    expect(screen.queryByText('slack-template')).not.toBeInTheDocument();
    await userEvent.click(input);
    expect(screen.getAllByRole('option')).toHaveLength(Object.keys(alertmanagerConfigMock.template_files).length + 3); // 4 templates in mock plus 3 in the default template
    const template = screen.getByRole('option', { name: 'slack-template' });
    await userEvent.click(template);
    expect(screen.getByText('slack-template')).toBeInTheDocument();
  });
});
