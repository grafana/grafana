import { useAsync } from 'react-use';

type AsyncState<T> =
  | {
      loading: boolean;
      error?: undefined;
      value?: undefined;
    }
  | {
      loading: false;
      error: Error;
      value?: undefined;
    }
  | {
      loading: false;
      error?: undefined;
      value: T;
    };

interface FetchProps<Q = any, T = any> {
  loadData: (query?: Q) => Promise<T>;
  query?: Q;
  onDataLoad?: (data: T) => void;
  debounce?: number;
  children: (state: AsyncState<T>) => JSX.Element;
}

export function Fetch<A, T>({ loadData, onDataLoad, children, query }: FetchProps<A, T>) {
  const data = useAsync(async () => {
    try {
      const result = await loadData(query);

      if (onDataLoad) {
        onDataLoad(result);
      }
      return result;
    } catch (e) {
      throw e;
    }
  }, [loadData, query]);
  return children(data);
}
