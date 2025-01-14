import { debounce } from 'lodash';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ListChildComponentProps, VariableSizeList } from 'react-window';

import { CoreApp, LogRowModel } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { getLogLineSize, LogLine } from './LogLine';
import { preProcessLogs } from './processing';
import { init as initVirtualization } from './virtualization';

interface Props {
  app?: CoreApp;
  logs: LogRowModel[];
  containerElement: HTMLDivElement | null;
  wrapLogMessage: boolean;
}

export const LogList = ({ containerElement, logs, wrapLogMessage }: Props) => {
  const [listKey, setListKey] = useState(`${Math.random()}`);
  const theme = useTheme2();
  const processedLogs = useMemo(() => preProcessLogs(logs, { wrapLogMessage }), [logs, wrapLogMessage]);

  useEffect(() => {
    initVirtualization(theme);
  }, [theme]);

  useEffect(() => {
    setListKey(`${Math.random()}`);
  }, [processedLogs]);

  useLayoutEffect(() => {
    const handleResize = debounce(() => setListKey(`${Math.random()}`), 500);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      return <LogLine log={processedLogs[index]} style={style} wrapLogMessage={wrapLogMessage} />;
    },
    [processedLogs, wrapLogMessage]
  );

  const height = window.innerHeight * 0.75;

  if (!containerElement) {
    // Wait for container to be rendered
    return null;
  }

  return (
    <VariableSizeList
      key={listKey}
      height={height}
      itemCount={processedLogs.length}
      itemSize={getLogLineSize.bind(null, processedLogs, containerElement, theme, wrapLogMessage)}
      itemKey={(index: number) => index}
      width={'100%'}
      layout="vertical"
    >
      {Renderer}
    </VariableSizeList>
  );
};
