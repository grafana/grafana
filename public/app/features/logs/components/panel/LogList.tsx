import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ListChildComponentProps, ListOnScrollProps, VariableSizeList } from 'react-window';

import { CoreApp, LogRowModel } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LogLine } from './LogLine';
import { preProcessLogs, ProcessedLogModel } from './processing';
import { getLogLineSize, init as initVirtualization, storeLogLineSize } from './virtualization';

interface Props {
  app?: CoreApp;
  logs: LogRowModel[];
  containerElement: HTMLDivElement | null;
  forceEscape?: boolean;
  wrapLogMessage: boolean;
}

export const LogList = ({ containerElement, logs, forceEscape = false, wrapLogMessage }: Props) => {
  const [processedLogs, setProcessedLogs] = useState<ProcessedLogModel[]>([]);
  const theme = useTheme2();
  const listRef = useRef<VariableSizeList | null>(null);

  useEffect(() => {
    initVirtualization(theme);
  }, [theme]);

  useEffect(() => {
    setProcessedLogs(preProcessLogs(logs, { wrap: wrapLogMessage, escape: forceEscape }));
    listRef.current?.resetAfterIndex(0);
    listRef.current?.scrollTo(0);
  }, [forceEscape, logs, wrapLogMessage]);

  useLayoutEffect(() => {
    const handleResize = () => listRef.current?.resetAfterIndex(0);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [processedLogs]);

  const handleOverflow = useCallback(
    (index: number, id: string, height: number) => {
      if (containerElement) {
        storeLogLineSize(id, containerElement, height);
        listRef.current?.resetAfterIndex(index);
      }
    },
    [containerElement]
  );

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      return (
        <LogLine
          index={index}
          log={processedLogs[index]}
          style={style}
          wrapLogMessage={wrapLogMessage}
          onOverflow={handleOverflow}
        />
      );
    },
    [handleOverflow, processedLogs, wrapLogMessage]
  );

  const height = window.innerHeight * 0.75;

  if (!containerElement) {
    // Wait for container to be rendered
    return null;
  }

  return (
    <VariableSizeList
      height={height}
      itemCount={processedLogs.length}
      itemSize={getLogLineSize.bind(null, processedLogs, containerElement, theme, wrapLogMessage)}
      itemKey={(index: number) => processedLogs[index].uid}
      layout="vertical"
      ref={listRef}
      style={{ overflowY: 'scroll' }}
      width="100%"
    >
      {Renderer}
    </VariableSizeList>
  );
};
