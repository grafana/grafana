import { renderHook, waitFor } from '@testing-library/react';

import { type ScopeNode } from '@grafana/data';

import { useScopeNode } from './useScopeNode';

jest.mock('../ScopesContextProvider', () => ({
  useScopesServices: jest.fn(),
}));

const { useScopesServices } = jest.requireMock('../ScopesContextProvider');

const node = (name: string): ScopeNode => ({
  metadata: { name },
  spec: { title: name, nodeType: 'leaf', linkType: 'scope', linkId: `link-${name}`, parentName: 'parent' },
});

describe('useScopeNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads the node through the selector service', async () => {
    const getScopeNode = jest.fn().mockResolvedValue(node('a'));
    useScopesServices.mockReturnValue({ scopesSelectorService: { getScopeNode } });

    const { result } = renderHook(() => useScopeNode('a'));

    await waitFor(() => expect(result.current.node).toEqual(node('a')));
    expect(getScopeNode).toHaveBeenCalledWith('a');
    expect(result.current.isLoading).toBe(false);
  });

  it('reports loading until the node arrives', async () => {
    let resolve: (value: ScopeNode) => void = () => {};
    const getScopeNode = jest.fn().mockReturnValue(new Promise<ScopeNode>((r) => (resolve = r)));
    useScopesServices.mockReturnValue({ scopesSelectorService: { getScopeNode } });

    const { result } = renderHook(() => useScopeNode('a'));
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.node).toBeUndefined();

    resolve(node('a'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.node).toEqual(node('a'));
  });

  it('loads again when the id changes', async () => {
    const getScopeNode = jest.fn().mockImplementation(async (name: string) => node(name));
    useScopesServices.mockReturnValue({ scopesSelectorService: { getScopeNode } });

    const { result, rerender } = renderHook(({ id }) => useScopeNode(id), { initialProps: { id: 'a' } });
    await waitFor(() => expect(result.current.node?.metadata.name).toBe('a'));

    rerender({ id: 'b' });

    await waitFor(() => expect(result.current.node?.metadata.name).toBe('b'));
    expect(getScopeNode).toHaveBeenCalledTimes(2);
  });

  it('has no node and does not call the service without an id', async () => {
    const getScopeNode = jest.fn();
    useScopesServices.mockReturnValue({ scopesSelectorService: { getScopeNode } });

    const { result } = renderHook(() => useScopeNode(undefined));

    expect(result.current).toEqual({ node: undefined, isLoading: false });
    expect(getScopeNode).not.toHaveBeenCalled();
  });

  it('has no node and never reports loading when there is no selector service', () => {
    useScopesServices.mockReturnValue(undefined);

    const { result } = renderHook(() => useScopeNode('a'));

    expect(result.current).toEqual({ node: undefined, isLoading: false });
  });

  it('logs the failure, keeps no node, and stops loading when the service throws', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const getScopeNode = jest.fn().mockRejectedValue(new Error('boom'));
    useScopesServices.mockReturnValue({ scopesSelectorService: { getScopeNode } });

    const { result } = renderHook(() => useScopeNode('a'));

    await waitFor(() => expect(consoleError).toHaveBeenCalledWith('Failed to load node', expect.any(Error)));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.node).toBeUndefined();
    consoleError.mockRestore();
  });
});
