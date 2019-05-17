import { LogRowModel } from 'app/core/logs_model';
import { LogRowContextQueryResponse, SeriesData, DataQueryResponse } from '@grafana/ui';
import { useState, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';

export interface LogRowContextRows {
  before?: string[];
  after?: string[];
}

export interface HasMoreContextRows {
  before: boolean;
  after: boolean;
}

interface LogRowContextProviderProps {
  row: LogRowModel;
  getRowContext: (row: LogRowModel, limit: number) => Promise<DataQueryResponse>;
  children: (props: {
    result: LogRowContextRows;
    hasMoreContextRows: HasMoreContextRows;
    updateLimit: () => void;
  }) => JSX.Element;
}

export const LogRowContextProvider: React.FunctionComponent<LogRowContextProviderProps> = ({
  getRowContext,
  row,
  children,
}) => {
  const [limit, setLimit] = useState(10);
  const [result, setResult] = useState<LogRowContextQueryResponse>(null);
  const [hasMoreContextRows, setHasMoreContextRows] = useState({
    before: true,
    after: true,
  });

  const { value } = useAsync(async () => {
    const context = await getRowContext(row, limit);
    return {
      data: context.data.map(series => {
        if ((series as SeriesData).rows) {
          return (series as SeriesData).rows.map(row => row[1]);
        }
        return [];
      }),
    };
  }, [limit]);

  useEffect(() => {
    if (value) {
      setResult(currentResult => {
        let hasMoreLogsBefore = true,
          hasMoreLogsAfter = true;

        if (currentResult && currentResult.data[0].length === value.data[0].length) {
          hasMoreLogsBefore = false;
        }

        if (currentResult && currentResult.data[1].length === value.data[1].length) {
          hasMoreLogsAfter = false;
        }

        setHasMoreContextRows({
          before: hasMoreLogsBefore,
          after: hasMoreLogsAfter,
        });

        return value;
      });
    }
  }, [value]);

  return children({
    result: {
      before: result ? result.data[0] : [],
      after: result ? result.data[1] : [],
    },
    hasMoreContextRows,
    updateLimit: () => setLimit(limit + 10),
  });
};
