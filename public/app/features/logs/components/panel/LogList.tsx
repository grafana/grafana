import { useCallback, useEffect, useState } from 'react';
import { ListChildComponentProps, VariableSizeList } from 'react-window';

import { CoreApp, LogRowModel } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { getLogLineSize, LogLine } from './LogLine';
import { init as initVirtualization } from './virtualization';

interface Props {
  app?: CoreApp;
  logs: LogRowModel[];
  containerElement: HTMLDivElement | null;
}

export const LogList = ({ containerElement, logs }: Props) => {
  const [listKey, setListKey] = useState(`${Math.random()}`);
  const theme = useTheme2();

  useEffect(() => {
    const letterSpacing = theme.typography.body.letterSpacing
      ? theme.typography.fontSize * parseFloat(theme.typography.body.letterSpacing)
      : undefined;
    initVirtualization(theme.typography.fontFamilyMonospace, theme.typography.fontSize, letterSpacing);
  }, [theme.typography.body.letterSpacing, theme.typography.fontFamilyMonospace, theme.typography.fontSize]);

  useEffect(() => {
    setListKey(`${Math.random()}`);
  }, [logs]);

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      return <LogLine log={logs[index]} style={style} />;
    },
    [logs]
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
      itemCount={logs.length}
      itemSize={getLogLineSize.bind(null, logs, containerElement, theme)}
      itemKey={(index: number) => index}
      width={'100%'}
      layout="vertical"
    >
      {Renderer}
    </VariableSizeList>
  );
};
