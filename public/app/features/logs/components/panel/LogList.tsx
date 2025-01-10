import { useCallback } from "react";
import { ListChildComponentProps, VariableSizeList } from "react-window";

import { CoreApp, LogRowModel } from "@grafana/data";

import { LogLine } from "./LogLine";

interface Props {
  app?: CoreApp;
  logs: LogRowModel[];
}

export const LogList = ({ logs }: Props) => {
  const Renderer = useCallback(({ index, style }: ListChildComponentProps) => {
    return <LogLine log={logs[index]} style={style} />
  }, [logs]);

  const height = window.innerHeight * 0.75;

  return (
    <VariableSizeList
      height={height}
      itemCount={logs.length}
      itemSize={getLogLineSize}
      itemKey={(index: number) => index}
      width={'100%'}
      layout="vertical"
    >
      {Renderer}
    </VariableSizeList>
  );
}

function getLogLineSize() {
  return 20;
}
