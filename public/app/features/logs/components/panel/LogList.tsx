import { debounce } from 'lodash';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ListChildComponentProps, VariableSizeList } from 'react-window';

import { CoreApp, EventBus, LogRowModel, LogsSortOrder } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { LogLine } from './LogLine';
import { preProcessLogs, ProcessedLogModel } from './processing';
import {
  getLogLineSize,
  init as initVirtualization,
  resetLogLineSizes,
  ScrollToLogsEvent,
  storeLogLineSize,
} from './virtualization';

interface Props {
  app: CoreApp;
  logs: LogRowModel[];
  containerElement: HTMLDivElement;
  eventBus: EventBus;
  forceEscape?: boolean;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  timeZone: string;
  wrapLogMessage: boolean;
}

export const LogList = ({
  app,
  containerElement,
  logs,
  eventBus,
  forceEscape = false,
  showTime,
  sortOrder,
  timeZone,
  wrapLogMessage,
}: Props) => {
  const [processedLogs, setProcessedLogs] = useState<ProcessedLogModel[]>([]);
  const [listHeight, setListHeight] = useState(
    app === CoreApp.Explore ? window.innerHeight * 0.75 : containerElement.clientHeight
  );
  const theme = useTheme2();
  const listRef = useRef<VariableSizeList | null>(null);
  const widthRef = useRef(containerElement.clientWidth);

  useEffect(() => {
    initVirtualization(theme);
  }, [theme]);

  useEffect(() => {
    const subscription = eventBus.subscribe(ScrollToLogsEvent, (e: ScrollToLogsEvent) => {
      if (e.payload.scrollTo === 'top') {
        listRef.current?.scrollTo(0);
      } else {
        listRef.current?.scrollToItem(processedLogs.length - 1);
      }
    });
    return () => subscription.unsubscribe();
  }, [eventBus, processedLogs.length]);

  useEffect(() => {
    setProcessedLogs(preProcessLogs(logs, { wrap: wrapLogMessage, escape: forceEscape, order: sortOrder, timeZone }));
    listRef.current?.resetAfterIndex(0);
    listRef.current?.scrollTo(0);
  }, [forceEscape, logs, sortOrder, timeZone, wrapLogMessage]);

  useEffect(() => {
    const handleResize = debounce(() => {
      setListHeight(app === CoreApp.Explore ? window.innerHeight * 0.75 : containerElement.clientHeight);
    }, 50);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [app, containerElement.clientHeight]);

  useLayoutEffect(() => {
    if (widthRef.current === containerElement.clientWidth) {
      return;
    }
    resetLogLineSizes();
    listRef.current?.resetAfterIndex(0);
    widthRef.current = containerElement.clientWidth;
  });

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
          showTime={showTime}
          style={style}
          wrapLogMessage={wrapLogMessage}
          onOverflow={handleOverflow}
        />
      );
    },
    [handleOverflow, processedLogs, showTime, wrapLogMessage]
  );

  if (!containerElement || listHeight == null) {
    // Wait for container to be rendered
    return null;
  }

  return (
    <VariableSizeList
      height={listHeight}
      itemCount={processedLogs.length}
      itemSize={getLogLineSize.bind(null, processedLogs, containerElement, { wrap: wrapLogMessage, showTime })}
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
