import { useQueryParams } from 'app/core/hooks/useQueryParams';

/**
 * Hook to get a properly typed URL ref param
 */
export const usePRBranch = () => {
  const [queryParams] = useQueryParams();
  const ref = queryParams['ref'];
  if (typeof ref !== 'string') {
    return undefined;
  }
  return ref;
};
