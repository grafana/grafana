import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { K8sNameLookup } from './K8sNameLookup';
import { NamespaceContext, ResourceContext } from './plugins';

function Lookup({ namespace, namespaced = true }: { namespace?: string; namespaced?: boolean }) {
  return (
    <NamespaceContext.Provider value={namespace}>
      <ResourceContext.Provider value={{ group: 'test.grafana.app', version: 'v1', resource: 'items', namespaced }}>
        <K8sNameLookup Original="input" props={{}} onChange={() => {}} />
      </ResourceContext.Provider>
    </NamespaceContext.Provider>
  );
}

function table(name: string) {
  return new Response(JSON.stringify({ rows: [{ object: { metadata: { name } } }] }));
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('allows manual entry without requesting an unknown namespace', async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(table('unexpected'));
  render(<Lookup />);

  await user.type(screen.getByRole('combobox'), 'manual-name');
  await act(async () => jest.advanceTimersByTime(250));

  expect(screen.getByText('Use: manual-name')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  {
    namespaced: true,
    namespace: 'stacks-31701',
    url: 'apis/test.grafana.app/v1/namespaces/stacks-31701/items?limit=100',
  },
  { namespaced: false, namespace: undefined, url: 'apis/test.grafana.app/v1/items?limit=100' },
])('loads resources from $url', async ({ namespaced, namespace, url }) => {
  const user = userEvent.setup();
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(table('my-item'));
  render(<Lookup namespace={namespace} namespaced={namespaced} />);

  await user.click(screen.getByRole('combobox'));

  expect(await screen.findByText('my-item')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(url, expect.any(Object));
});

it('ignores an older namespace response after the namespace changes', async () => {
  const user = userEvent.setup();
  let resolveOldResponse!: (response: Response) => void;
  const oldResponse = new Promise<Response>((resolve) => {
    resolveOldResponse = resolve;
  });
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockReturnValueOnce(oldResponse)
    .mockResolvedValueOnce(table('new-item'));
  const { rerender } = render(<Lookup namespace="old-namespace" />);
  await user.click(screen.getByRole('combobox'));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

  rerender(<Lookup namespace="stacks-31701" />);
  expect(await screen.findByText('new-item')).toBeInTheDocument();

  await act(async () => resolveOldResponse(table('old-item')));

  expect(screen.getByText('new-item')).toBeInTheDocument();
  expect(screen.queryByText('old-item')).not.toBeInTheDocument();
});

it('allows manual entry after a network failure', async () => {
  const user = userEvent.setup();
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  render(<Lookup namespace="stacks-31701" />);

  await user.type(screen.getByRole('combobox'), 'manual-name');

  expect(await screen.findByText('Use: manual-name')).toBeInTheDocument();
  expect(warn).toHaveBeenCalledWith('Error loading names', expect.any(Error));
  expect(screen.queryByText('Loading kubernetes names...')).not.toBeInTheDocument();
});
