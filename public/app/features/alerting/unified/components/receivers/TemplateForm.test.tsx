import { render, screen, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { KnownProvenance } from '../../types/knownProvenance';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { NotificationTemplate } from '../contact-points/useNotificationTemplates';

import { TemplateForm } from './TemplateForm';

function createMockTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    uid: 'test-template',
    title: 'Test Template',
    content: '{{ define "test" }}Test{{ end }}',
    provenance: KnownProvenance.None,
    kind: 'grafana',
    ...overrides,
  };
}

function renderTemplateForm(template?: NotificationTemplate) {
  return render(
    <AlertmanagerProvider accessType="notification">
      <TemplateForm originalTemplate={template} alertmanager={GRAFANA_RULES_SOURCE_NAME} />
    </AlertmanagerProvider>
  );
}

setupMswServer();

describe('TemplateForm', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  describe('provisioning alerts', () => {
    it('should show ProvisioningAlert when template is provisioned via file', async () => {
      const template = createMockTemplate({ provenance: KnownProvenance.File });

      renderTemplateForm(template);

      const alert = await screen.findByRole('status');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText(/This template cannot be edited through the UI/)).toBeInTheDocument();
      expect(screen.getByText(/has been provisioned/)).toBeInTheDocument();
    });

    it('should show ProvisioningAlert when template is provisioned via API', async () => {
      const template = createMockTemplate({ provenance: KnownProvenance.API });

      renderTemplateForm(template);

      const alert = await screen.findByRole('status');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText(/This template cannot be edited through the UI/)).toBeInTheDocument();
      expect(screen.getByText(/has been provisioned/)).toBeInTheDocument();
    });

    it('should show ImportedResourceAlert when template is imported (ConvertedPrometheus)', async () => {
      const template = createMockTemplate({ provenance: KnownProvenance.ConvertedPrometheus });

      renderTemplateForm(template);

      const alert = await screen.findByRole('status');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText(/This template was imported and cannot be edited through the UI/)).toBeInTheDocument();
      expect(screen.getByText(/imported from an external Alertmanager/)).toBeInTheDocument();
    });

    it('should not show any provisioning alert when template has no provenance', async () => {
      const template = createMockTemplate({ provenance: KnownProvenance.None });

      renderTemplateForm(template);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByRole('form', { name: /template form/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should not show any provisioning alert when creating a new template', async () => {
      renderTemplateForm(undefined);

      // Wait for form to render
      await waitFor(() => {
        expect(screen.getByRole('form', { name: /template form/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
