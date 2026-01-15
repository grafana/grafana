import { render, screen, within } from 'test/test-utils';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { KnownProvenance } from '../../types/knownProvenance';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { NotificationTemplate } from '../contact-points/useNotificationTemplates';

import { TemplatesTable } from './TemplatesTable';

const mockTemplates: Array<Partial<NotificationTemplate>> = [
  {
    uid: 'mimir-template',
    title: 'mimir-template',
    content: '{{ define "mimir-template" }}Template from Mimir{{ end }}',
    provenance: KnownProvenance.ConvertedPrometheus,
  },
  {
    uid: 'file-template',
    title: 'file-template',
    content: '{{ define "file-template" }}File provisioned template{{ end }}',
    provenance: KnownProvenance.File,
  },
  {
    uid: 'api-template',
    title: 'api-template',
    content: '{{ define "api-template" }}API provisioned template{{ end }}',
    provenance: KnownProvenance.API,
  },
  {
    uid: 'no-provenance-template',
    title: 'no-provenance-template',
    content: '{{ define "no-provenance-template" }}No provenance template{{ end }}',
    provenance: KnownProvenance.None,
  },
  {
    uid: 'undefined-provenance-template',
    title: 'undefined-provenance-template',
    content: '{{ define "undefined-provenance-template" }}Undefined provenance template{{ end }}',
    provenance: undefined,
  },
];

const renderWithProvider = (templates: Array<Partial<NotificationTemplate>>) => {
  return render(
    <AlertmanagerProvider accessType={'notification'}>
      <TemplatesTable alertManagerName={GRAFANA_RULES_SOURCE_NAME} templates={templates as NotificationTemplate[]} />
      <AppNotificationList />
    </AlertmanagerProvider>
  );
};

setupMswServer();

describe('TemplatesTable', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
    ]);
  });

  it('shows "Imported" badge for templates with converted_prometheus provenance', () => {
    const templates = [mockTemplates[0]]; // mimir-template
    renderWithProvider(templates);

    const templateRow = screen.getByRole('row', { name: /mimir-template/i });
    const badge = within(templateRow).getByText('Imported');
    expect(badge).toBeInTheDocument();
  });

  it('shows "Provisioned" badge for templates with other provenance', () => {
    // api and file templates
    [mockTemplates[1], mockTemplates[2]].forEach((template) => {
      renderWithProvider([template]);

      const templateRow = screen.getByRole('row', { name: new RegExp(template.title ?? '', 'i') });
      const badge = within(templateRow).getByText('Provisioned');
      expect(badge).toBeInTheDocument();
    });
  });

  it('does not show badge for templates with KnownProvenance.None or empty string provenance', () => {
    // no-provenance-template and undefined-provenance-template
    [mockTemplates[3], mockTemplates[4]].forEach((template) => {
      renderWithProvider([template]);

      const templateRow = screen.getByRole('row', { name: new RegExp(template.title ?? '', 'i') });
      expect(within(templateRow).queryByText('Provisioned')).not.toBeInTheDocument();
    });
  });
});
