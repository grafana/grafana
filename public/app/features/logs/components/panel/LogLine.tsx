import { CSSProperties } from "react";

import { LogRowModel } from "@grafana/data";

interface Props {
  log: LogRowModel;
  style: CSSProperties;
}

export const LogLine = ({ log, style }: Props) => {
  return (
    <div style={style}>
      {log.entry}
    </div>
  )
}
