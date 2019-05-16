import { LogRowModel } from 'app/core/logs_model';
import { LogRowContextQueryResponse } from '@grafana/ui';
import { useState, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';

export interface LogRowContextRows {
  before?: string[];
  after?: string[];
}

interface LogRowContextProviderProps {
  row: LogRowModel;
  getRowContext: (row: LogRowModel, limit?: number) => Promise<LogRowContextQueryResponse>;
  children: (props: { result: LogRowContextRows; updateLimit: () => void }) => JSX.Element;
}

export const LogRowContextProvider: React.FunctionComponent<LogRowContextProviderProps> = ({
  getRowContext,
  row,
  children,
}) => {
  const [limit, setLimit] = useState(10);
  const [result, setResult] = useState(null);

  const { value } = useAsync(async () => {
    return getRowContext(row, limit);
  }, [limit]);

  useEffect(() => {
    if (value) {
      setResult(value);
    }
  }, [value]);

  return children({
    result: {
      before: result ? result.data[0] : [],
      after: result ? result.data[1] : [],
    },
    updateLimit: () => setLimit(limit + 10),
  });
};
