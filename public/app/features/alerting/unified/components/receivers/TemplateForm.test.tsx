import { EditorView } from '@codemirror/view';
import { HttpResponse, http } from 'msw';
import { type Props } from 'react-virtualized-auto-sizer';
import { render, screen, waitFor } from 'test/test-utils';

import { AccessControlAction } from 'app/types/accessControl';

import { type TemplatesTestPayload, previewTemplateUrl } from '../../api/templateApi';
import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { KnownProvenance } from '../../types/knownProvenance';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { type NotificationTemplate } from '../contact-points/useNotificationTemplates';

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

jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: Props) =>
      children({ width: 600, height: 400, scaledWidth: 1, scaledHeight: 1 })
);

const server = setupMswServer();

describe('TemplateForm', () => {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });

  it('sends edited content to server preview on blur and displays server validation errors', async () => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
      AccessControlAction.AlertingNotificationsTemplatesTest,
    ]);
    const requests: TemplatesTestPayload[] = [];
    server.use(
      http.post(previewTemplateUrl, async ({ request }) => {
        const body = (await request.json()) as TemplatesTestPayload;
        requests.push(body);
        return HttpResponse.json({
          errors: body.template === '{{ broken' ? [{ kind: 'invalid_template', message: 'Server template error' }] : [],
        });
      })
    );
    const { user } = renderTemplateForm(createMockTemplate());
    const editor = await screen.findByRole('textbox', { name: 'Template group' });
    await waitFor(() => expect(requests.at(-1)?.template).toBe('{{ define "test" }}Test{{ end }}'));

    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    await user.paste('{{ broken');
    expect(editor).toHaveTextContent(/^\{\{ broken$/);
    expect(requests.at(-1)?.template).toBe('{{ define "test" }}Test{{ end }}');

    await user.click(screen.getByRole('textbox', { name: /Template group name/ }));
    await waitFor(() => expect(requests.at(-1)).toMatchObject({ name: 'Test Template', template: '{{ broken' }));
    expect(await screen.findByText('Server template error')).toBeInTheDocument();
  });

  it('allows editing and inserting examples without exposing preview controls when test permission is missing', async () => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingTemplatesWrite]);
    const { user } = renderTemplateForm(createMockTemplate());
    const editor = await screen.findByRole('textbox', { name: 'Template group' });
    await user.click(editor);
    await user.keyboard('{Control>}{End}{/Control}');
    await user.paste(' edited');

    expect(editor).toHaveTextContent('{{ define "test" }}Test{{ end }} edited');
    expect(screen.queryByRole('button', { name: 'Refresh preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Payload' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add example' }));
    await user.click(screen.getByRole('menuitem', { name: 'Default templates for notification titles' }));
    await waitFor(() => expect(editor).toHaveTextContent('{{ define "default.title.copy" }}'));
    expect(editor).toHaveTextContent('{{ define "test" }}Test{{ end }} edited');
  });

  describe('provisioning alerts', () => {
    it.each([KnownProvenance.File, KnownProvenance.API])(
      'keeps %s-provisioned templates read-only',
      async (provenance) => {
        const template = createMockTemplate({ provenance });

        const { user } = renderTemplateForm(template);

        const alert = await screen.findByRole('status');
        expect(alert).toBeInTheDocument();
        expect(screen.getByText(/This template cannot be edited through the UI/)).toBeInTheDocument();
        expect(screen.getByText(/has been provisioned/)).toBeInTheDocument();
        const editor = await screen.findByRole('textbox', { name: 'Template group' });
        expect(EditorView.findFromDOM(editor)?.state.readOnly).toBe(true);
        await user.click(editor);
        await user.keyboard('{Control>}a{/Control}');
        await user.paste('Changed');
        expect(editor).toHaveTextContent('{{ define "test" }}Test{{ end }}');
      }
    );

    it('should show ImportedResourceAlert when template is imported (ConvertedPrometheus)', async () => {
      const template = createMockTemplate({ provenance: KnownProvenance.ConvertedPrometheus });

      const { user } = renderTemplateForm(template);

      const alert = await screen.findByRole('status');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText(/This template was imported and cannot be edited through the UI/)).toBeInTheDocument();
      expect(screen.getByText(/imported from an external Alertmanager/)).toBeInTheDocument();
      const editor = await screen.findByRole('textbox', { name: 'Template group' });
      expect(EditorView.findFromDOM(editor)?.state.readOnly).toBe(true);
      await user.click(editor);
      await user.keyboard('{Control>}a{/Control}');
      await user.paste('Changed');
      expect(editor).toHaveTextContent('{{ define "test" }}Test{{ end }}');
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

  describe('legacy alerts', () => {
    it('should show legacy alert when template has mimir kind', async () => {
      const template = createMockTemplate({ kind: 'mimir' });
      renderTemplateForm(template);

      expect(await screen.findByRole('alert', { name: /uses a legacy format/ })).toBeInTheDocument();
    });

    it('should show both imported and legacy alerts when template is mimir kind with ConvertedPrometheus provenance', async () => {
      const template = createMockTemplate({ kind: 'mimir', provenance: KnownProvenance.ConvertedPrometheus });
      renderTemplateForm(template);

      expect(await screen.findByText(/imported from an external Alertmanager/)).toBeInTheDocument();
      expect(screen.getByRole('alert', { name: /uses a legacy format/ })).toBeInTheDocument();
    });

    it('should not show legacy alert for grafana kind templates', async () => {
      const template = createMockTemplate({ kind: 'grafana' });
      renderTemplateForm(template);

      await waitFor(() => {
        expect(screen.getByRole('form', { name: /template form/i })).toBeInTheDocument();
      });

      expect(screen.queryByRole('alert', { name: /uses a legacy format/ })).not.toBeInTheDocument();
    });
  });
});
