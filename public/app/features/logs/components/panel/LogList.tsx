import { debounce } from 'lodash';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ListChildComponentProps, ListOnScrollProps, VariableSizeList } from 'react-window';

import { CoreApp, LogRowModel } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LogLine } from './LogLine';
import { preProcessLogs } from './processing';
import { getLogLineSize, init as initVirtualization, storeLogLineSize } from './virtualization';

interface Props {
  app?: CoreApp;
  logs: LogRowModel[];
  containerElement: HTMLDivElement | null;
  forceEscape?: boolean;
  wrapLogMessage: boolean;
}

export const LogList = ({ containerElement, logs, forceEscape = false, wrapLogMessage }: Props) => {
  const [listKey, setListKey] = useState(`${Math.random()}`);
  const theme = useTheme2();
  const processedLogs = useMemo(
    () => preProcessLogs(logs, { wrap: wrapLogMessage, escape: forceEscape }),
    [forceEscape, logs, wrapLogMessage]
  );
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    initVirtualization(theme);
  }, [theme]);

  useEffect(() => {
    setListKey(`${Math.random()}`);
    scrollPositionRef.current = 0;
  }, [processedLogs]);

  useLayoutEffect(() => {
    const handleResize = debounce(() => setListKey(`${Math.random()}`), 500);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const setScrollPosition = useCallback(({ scrollOffset }: ListOnScrollProps) => {
    scrollPositionRef.current = scrollOffset;
  }, []);

  const handleOverflow = useCallback(
    (id: string, height: number) => {
      if (containerElement) {
        storeLogLineSize(id, containerElement, height);
        setListKey(`${Math.random()}`);
      }
    },
    [containerElement]
  );

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      return (
        <LogLine log={processedLogs[index]} style={style} wrapLogMessage={wrapLogMessage} onOverflow={handleOverflow} />
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
      key={listKey}
      height={height}
      initialScrollOffset={scrollPositionRef.current}
      itemCount={processedLogs.length}
      itemSize={getLogLineSize.bind(null, processedLogs, containerElement, theme, wrapLogMessage)}
      itemKey={(index: number) => processedLogs[index].uid}
      layout="vertical"
      onScroll={setScrollPosition}
      style={{ overflowY: 'scroll' }}
      width="100%"
    >
      {Renderer}
    </VariableSizeList>
  );
};
