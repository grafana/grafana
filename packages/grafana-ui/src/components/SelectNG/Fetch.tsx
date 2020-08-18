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
  debounce?: number;
  children: (state: AsyncState<T>) => JSX.Element;
}

export function Fetch<A, T>({ loadData, children, query }: FetchProps<A, T>) {
  const data = useAsync(async () => await loadData(query), [loadData, query]);
  return children(data);
}
