import { useAsync } from 'react-use';

// Allows simple dynamic imports in the components
export const useAsyncDependency = <T>(importStatement: Promise<T>) => {
  const state = useAsync(async () => {
    return await importStatement;
  });

  return {
    ...state,
    dependency: state.value,
  };
};
