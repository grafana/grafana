import { LogRowModel } from 'app/core/logs_model';
import { LogRowContextQueryResponse } from '@grafana/ui';
import { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';

export interface LogRowContextRows {
  before?: string[];
  after?: string[];
}

interface LogRowContextProviderProps {
  row: LogRowModel;
  getRowContext: (row: LogRowModel, limit?: number) => Promise<LogRowContextQueryResponse>;
  children: (props: { result: LogRowContextRows; updateLimit: (limit: number) => void }) => JSX.Element;
}

export const LogRowContextProvider: React.FunctionComponent<LogRowContextProviderProps> = ({
  getRowContext,
  row,
  children,
}) => {
  const [limit, setLimit] = useState(10);

  const { value } = useAsync(async () => {
    return getRowContext(row, limit);
  }, [limit]);

  return children({
    result: {
      before: value ? value.data[0] : [],
      after: value ? value.data[1] : [],
    },
    updateLimit: (limit: number) => setLimit(limit),
  });
};
