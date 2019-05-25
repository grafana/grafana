import { DataQueryResponse, DataQueryError, LogRowModel } from '@grafana/ui';
import { useState, useEffect } from 'react';
import flatten from 'lodash/flatten';
import useAsync from 'react-use/lib/useAsync';

export interface LogRowContextRows {
  before?: string[];
  after?: string[];
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
  getRowContext: (row: LogRowModel, options?: any) => Promise<DataQueryResponse>;
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
  const [result, setResult] = useState<{
    data: string[][];
    errors: string[];
  }>(null);
  const [hasMoreContextRows, setHasMoreContextRows] = useState({
    before: true,
    after: true,
  });

  const { value } = useAsync(async () => {
    const promises = [
      getRowContext(row, {
        limit,
      }),
      getRowContext(row, {
        limit,
        direction: 'FORWARD',
      }),
    ];

    const results: Array<DataQueryResponse | DataQueryError> = await Promise.all(promises.map(p => p.catch(e => e)));

    return {
      data: results.map(result => {
        if ((result as DataQueryResponse).data) {
          return (result as DataQueryResponse).data.map(series => {
            return series.rows.map(row => row[1]);
          });
        } else {
          return [];
        }
      }),
      errors: results.map(result => {
        if ((result as DataQueryError).message) {
          return (result as DataQueryError).message;
        } else {
          return null;
        }
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
      before: result ? flatten(result.data[0]) : [],
      after: result ? flatten(result.data[1]) : [],
    },
    errors: {
      before: result ? result.errors[0] : null,
      after: result ? result.errors[1] : null,
    },
    hasMoreContextRows,
    updateLimit: () => setLimit(limit + 10),
  });
};
