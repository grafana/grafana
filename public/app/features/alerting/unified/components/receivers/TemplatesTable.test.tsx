import { EditorView } from '@codemirror/view';
import { render, screen, within } from 'test/test-utils';

import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { KnownProvenance } from '../../types/knownProvenance';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { type NotificationTemplate } from '../contact-points/useNotificationTemplates';

import { TemplatesTable } from './TemplatesTable';

const mockTemplates: Array<Partial<NotificationTemplate>> = [
  {
    uid: 'mimir-template',
    title: 'mimir-template',
    content: '{{ define "mimir-template" }}Template from Mimir{{ end }}',
    provenance: KnownProvenance.ConvertedPrometheus,
    kind: 'mimir',
  },
  {
    uid: 'file-template',
    title: 'file-template',
    content: '{{ define "file-template" }}File provisioned template{{ end }}',
    provenance: KnownProvenance.File,
    kind: 'grafana',
  },
  {
    uid: 'api-template',
    title: 'api-template',
    content: '{{ define "api-template" }}API provisioned template{{ end }}',
    provenance: KnownProvenance.API,
    kind: 'grafana',
  },
  {
    uid: 'no-provenance-template',
    title: 'no-provenance-template',
    content: '{{ define "no-provenance-template" }}No provenance template{{ end }}',
    provenance: KnownProvenance.None,
    kind: 'grafana',
  },
  {
    uid: 'undefined-provenance-template',
    title: 'undefined-provenance-template',
    content: '{{ define "undefined-provenance-template" }}Undefined provenance template{{ end }}',
    provenance: undefined,
    kind: 'grafana',
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

  it('expands unwrapped template content with automatic height inside a constrained read-only editor', async () => {
    const { user } = renderWithProvider([
      { ...mockTemplates[3], content: `${'x'.repeat(600)}\nSecond line\nThird line` },
    ]);
    const row = screen.getByRole('row', { name: /no-provenance-template/i });
    await user.click(within(row).getByRole('button', { expanded: false }));
    const editor = await screen.findByRole('textbox', { name: 'Template content' });

    expect(EditorView.findFromDOM(editor)?.state.doc.lines).toBe(3);
    expect(editor).toHaveTextContent('Second lineThird line');
    expect(EditorView.findFromDOM(editor)?.state.readOnly).toBe(true);
    // The editor's sizing and gutter are not exposed through accessible roles.
    // eslint-disable-next-line testing-library/no-node-access
    expect(editor.closest('.cm-editor')).toHaveStyle({ height: 'auto' });
    // eslint-disable-next-line testing-library/no-node-access
    expect(editor.closest('.cm-editor')?.querySelector('.cm-lineNumbers')).not.toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-node-access
    expect(editor.closest('.cm-editor')?.parentElement?.parentElement?.parentElement).toHaveStyle({
      minWidth: 0,
      contain: 'inline-size',
    });
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

  it('shows "Legacy" badge for templates with mimir kind', () => {
    renderWithProvider([
      {
        uid: 'mimir-only',
        title: 'mimir-only',
        content: '{{ define "mimir-only" }}Mimir template{{ end }}',
        provenance: KnownProvenance.None,
        kind: 'mimir',
      },
    ]);

    const row = screen.getByRole('row', { name: /mimir-only/i });
    expect(within(row).getByText('Legacy')).toBeInTheDocument();
  });

  it('shows both "Imported" and "Legacy" badges for mimir kind with converted_prometheus provenance', () => {
    renderWithProvider([mockTemplates[0]]); // kind: 'mimir', provenance: ConvertedPrometheus

    const row = screen.getByRole('row', { name: /mimir-template/i });
    expect(within(row).getByText('Imported')).toBeInTheDocument();
    expect(within(row).getByText('Legacy')).toBeInTheDocument();
  });

  it('does not show "Legacy" badge for templates with grafana kind', () => {
    renderWithProvider([mockTemplates[3]]); // kind: 'grafana', provenance: None

    const row = screen.getByRole('row', { name: /no-provenance-template/i });
    expect(within(row).queryByText('Legacy')).not.toBeInTheDocument();
  });
});
