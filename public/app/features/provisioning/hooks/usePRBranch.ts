import { useQueryParams } from 'app/core/hooks/useQueryParams';

/**
 * Hook to read the PR branch from the URL query parameter
 * When a user navigates from a pull request, the ref query param contains the branch name
 * @returns The branch name from the ref query parameter, or undefined if not present
 */
export const usePRBranch = () => {
  const [queryParams] = useQueryParams();
  const ref = queryParams['ref'] as string | undefined;
  return ref;
};
