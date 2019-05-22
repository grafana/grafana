import { LogRowModel } from 'app/core/logs_model';
import { LogRowContextQueryResponse, SeriesData, DataQueryResponse, DataQueryError } from '@grafana/ui';
import { useState, useEffect } from 'react';
import useAsync from 'react-use/lib/useAsync';

export interface LogRowContextRows {
  before?: Array<string | DataQueryError>;
  after?: Array<string | DataQueryError>;
}
export interface LogRowContextQueryErrors {
  before?: string;
  after?: string;
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
    errors: LogRowContextQueryErrors;
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
  const [errors, setErrors] = useState<LogRowContextQueryErrors>(null);
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
        } else {
          return [series];
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
        let beforeContextError, afterContextError;

        if (currentResult && currentResult.data[0].length === value.data[0].length) {
          hasMoreLogsBefore = false;
        }

        if (currentResult && currentResult.data[1].length === value.data[1].length) {
          hasMoreLogsAfter = false;
        }

        if (value.data[0] && value.data[0].length > 0 && value.data[0][0].message) {
          beforeContextError = value.data[0][0].message;
        }
        if (value.data[1] && value.data[1].length > 0 && value.data[1][0].message) {
          afterContextError = value.data[1][0].message;
        }

        setHasMoreContextRows({
          before: hasMoreLogsBefore,
          after: hasMoreLogsAfter,
        });

        setErrors({
          before: beforeContextError,
          after: afterContextError,
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
    errors,
    hasMoreContextRows,
    updateLimit: () => setLimit(limit + 10),
  });
};
