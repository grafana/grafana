import { useAsync } from 'react-use';
import debouncePromise from 'debounce-promise';
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

interface FetchProps<A, T> {
  loadData: (args: A) => Promise<T>;
  args: A;
  debounce?: number;
  children: (state: AsyncState<T>) => JSX.Element;
}
export function Fetch<A, T>({ loadData, children, args }: FetchProps<A, T>) {
  const data = useAsync(async () => await loadData(args), [loadData, args]);
  return children(data);
}
