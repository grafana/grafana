import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { useGetConnectionRepositoriesQuery } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { useInvalidateConnectionList } from './useConnectionList';

setupProvisioningMswServer();

// Uses a per-connection query (not the list) on purpose: those endpoints provide
// the type-only 'Connection' tag, which an id-specific invalidation would miss.
function Harness() {
  const invalidate = useInvalidateConnectionList();
  const { data } = useGetConnectionRepositoriesQuery({ name: 'conn-1' });

  return (
    <div>
      <span>{data ? 'loaded' : 'loading'}</span>
      <button onClick={invalidate}>invalidate</button>
    </div>
  );
}

describe('useInvalidateConnectionList', () => {
  it('refetches mounted per-connection repositories queries', async () => {
    let repoRequests = 0;
    server.use(
      http.get(`${BASE}/connections/:name/repositories`, () => {
        repoRequests++;
        return HttpResponse.json({ items: [] });
      })
    );

    const { user } = render(<Harness />);

    expect(await screen.findByText('loaded')).toBeInTheDocument();
    expect(repoRequests).toBe(1);

    await user.click(screen.getByRole('button', { name: 'invalidate' }));

    await waitFor(() => expect(repoRequests).toBe(2));
  });
});
