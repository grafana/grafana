import { css } from "@emotion/css";
import { CSSProperties } from "react";

import { GrafanaTheme2, LogRowModel } from "@grafana/data";
import { useTheme2 } from "@grafana/ui";

import { measureText } from "./virtualization";

interface Props {
  log: LogRowModel;
  style: CSSProperties;
}

export const LogLine = ({ log, style }: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <div style={style} className={styles.logLine}>
      {log.entry}
    </div>
  )
}

const getStyles = (theme: GrafanaTheme2) => ({
  logLine: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.body.fontSize,
    wordBreak: 'break-all',
    '&:hover': {
      opacity: 0.5,
    }
  }),
});

export function getLogLineSize(logs: LogRowModel[], container: HTMLDivElement | null, theme: GrafanaTheme2, index: number) {
  if (!container) {
    return 0;
  }
  const { height } = measureText(logs[index].entry, container.getBoundingClientRect().width, 22);
  return height;
}
