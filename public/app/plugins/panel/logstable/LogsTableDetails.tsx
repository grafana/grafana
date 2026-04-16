import { css } from "@emotion/css";
import { useState, useCallback, startTransition, useRef } from "react";

import { GrafanaTheme2, type TimeRange } from "@grafana/data";
import { ScrollContainer, useStyles2 } from "@grafana/ui";
import { LogLineDetailsComponent } from "app/features/logs/components/panel/LogLineDetailsComponent";
import { LogLineDetailsHeader } from "app/features/logs/components/panel/LogLineDetailsHeader";

import { useLogDetailsContext } from "./LogDetailsContext";

interface Props {
  timeRange: TimeRange;
  timeZone: string;
}

export const LogsTableDetails = ({ timeRange, timeZone }: Props) => {
  const { currentLog, logs, enableLogDetails } = useLogDetailsContext();
  const [search, setSearch] = useState('');
  const inputRef = useRef('');
  const styles = useStyles2(getStyles);

  const handleSearch = useCallback((newSearch: string) => {
        inputRef.current = newSearch;
        startTransition(() => {
          setSearch(inputRef.current);
        });
      }, []);

  if (!enableLogDetails || !currentLog) {
    return null;
  }

  return (
    <div className={styles.container}>
      <LogLineDetailsHeader log={currentLog} search={search} onSearch={handleSearch} />
      <ScrollContainer>
        <LogLineDetailsComponent
          log={currentLog}
          logs={logs}
          search={search}
          timeRange={timeRange}
          timeZone={timeZone}
        />
      </ScrollContainer>
    </div>
  )
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 99999,
    width: '25vw',
  }),
})
