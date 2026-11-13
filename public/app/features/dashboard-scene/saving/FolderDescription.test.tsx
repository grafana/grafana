/** @jest-environment jsdom */

import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { FolderDescription } from './FolderDescription';

setBackendSrv(backendSrv);
setupMockServer();

const FOLDER_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name';

function mockFolder(description?: string) {
  const requested = jest.fn();
  server.use(
    http.get(FOLDER_URL, ({ params }) => {
      requested(params.name);
      return HttpResponse.json({
        kind: 'Folder',
        apiVersion: 'folder.grafana.app/v1beta1',
        metadata: { name: params.name, namespace: params.namespace },
        spec: { title: 'Payments', description },
      });
    })
  );
  return requested;
}

describe('FolderDescription', () => {
  it('renders the markdown description with links that open in a new tab', async () => {
    mockFolder('Owned by **payments**. See the [runbook](https://example.com/runbook).');

    render(<FolderDescription folderUid="payments" />);

    const link = await screen.findByRole('link', { name: 'runbook' });
    expect(link).toHaveAttribute('href', 'https://example.com/runbook');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('payments').tagName).toBe('STRONG');
  });

  it('strips script and javascript: links from the description', async () => {
    mockFolder('[click](javascript:alert(1)) <img src="x" onerror="alert(1)"> <script>alert(1)</script>');

    const { container } = render(<FolderDescription folderUid="payments" />);

    expect(await screen.findByText('click')).not.toHaveAttribute('href');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).not.toHaveAttribute('onerror');
  });

  it('renders nothing for a folder without a description', async () => {
    const requested = mockFolder(undefined);

    const { container } = render(<FolderDescription folderUid="payments" />);

    await waitFor(() => expect(requested).toHaveBeenCalledWith('payments'));
    expect(container).toBeEmptyDOMElement();
  });

  it('does not fetch the root folder', () => {
    const requested = mockFolder('root');

    const { container } = render(<FolderDescription folderUid="general" />);

    expect(requested).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
