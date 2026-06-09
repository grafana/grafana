import { renderHook } from 'test/test-utils';

import { useUrlParams } from 'app/core/navigation/hooks';

import { usePullRequestParam } from './usePullRequestParam';

jest.mock('app/core/navigation/hooks');

const mockUseUrlParams = useUrlParams as jest.MockedFunction<typeof useUrlParams>;

function setParams(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  mockUseUrlParams.mockReturnValue([searchParams, jest.fn()]);
}

describe('usePullRequestParam', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setParams({});
  });

  describe('repoType', () => {
    it('returns valid repo type', () => {
      setParams({ repo_type: 'github' });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.repoType).toBe('github');
    });

    it('returns undefined for invalid repo type', () => {
      setParams({ repo_type: 'javascript:alert(1)' });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.repoType).toBeUndefined();
    });

    it('returns undefined for empty repo type', () => {
      setParams({});
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.repoType).toBeUndefined();
    });
  });

  describe('resourcePushedTo', () => {
    it('returns valid k8s name', () => {
      setParams({ resource_pushed_to: 'my-repo-123' });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.resourcePushedTo).toBe('my-repo-123');
    });

    it('rejects names with invalid characters', () => {
      setParams({ resource_pushed_to: 'INVALID_NAME' });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.resourcePushedTo).toBeUndefined();
    });

    it('rejects names starting with hyphen', () => {
      setParams({ resource_pushed_to: '-bad-name' });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.resourcePushedTo).toBeUndefined();
    });

    it('returns undefined when param is missing', () => {
      setParams({});
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.resourcePushedTo).toBeUndefined();
    });
  });

  describe('URL fields', () => {
    it('sanitizes javascript: URLs', () => {
      setParams({
        pull_request_url: 'javascript:alert(1)',
        new_pull_request_url: 'javascript:alert(2)',
        repo_url: 'javascript:alert(3)',
      });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.prURL).toBe('about:blank');
      expect(result.current.newPrURL).toBe('about:blank');
      expect(result.current.repoURL).toBe('about:blank');
    });

    it('preserves valid URLs', () => {
      setParams({
        pull_request_url: 'https://github.com/org/repo/pull/1',
      });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.prURL).toBe('https://github.com/org/repo/pull/1');
    });
  });

  describe('action', () => {
    it('accepts valid actions', () => {
      setParams({ action: 'create' });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.action).toBe('create');
    });

    it('rejects invalid actions', () => {
      setParams({ action: 'malicious' });
      const { result } = renderHook(() => usePullRequestParam());
      expect(result.current.action).toBeUndefined();
    });
  });
});
