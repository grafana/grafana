import { css } from '@emotion/css';
import { t } from 'i18next';
import { useState, useCallback, startTransition, useRef, useMemo } from 'react';

import { type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { Icon, ScrollContainer, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { LogLineDetailsComponent } from 'app/features/logs/components/panel/LogLineDetailsComponent';
import { LogLineDetailsHeader } from 'app/features/logs/components/panel/LogLineDetailsHeader';

import { useLogDetailsContext } from './LogDetailsContext';

interface Props {
  timeRange: TimeRange;
  timeZone: string;
}

export const LogsTableDetails = ({ timeRange, timeZone }: Props) => {
  const { currentLog, enableLogDetails, logs, setCurrentLog, showDetails, toggleDetails } = useLogDetailsContext();
  const [search, setSearch] = useState('');
  const inputRef = useRef('');
  const styles = useStyles2(getStyles);

  const handleSearch = useCallback((newSearch: string) => {
    inputRef.current = newSearch;
    startTransition(() => {
      setSearch(inputRef.current);
    });
  }, []);

  const tabs = useMemo(() => showDetails.slice().reverse(), [showDetails]);

  if (!enableLogDetails || !currentLog) {
    return null;
  }

  return (
    <div className={styles.container}>
      {showDetails.length > 1 && (
        <TabsBar>
          {tabs.map((log) => {
            return (
              <Tab
                key={log.uid}
                truncate
                label={log.entry.substring(0, 25)}
                active={currentLog.uid === log.uid}
                onChangeTab={() => setCurrentLog(log)}
                suffix={() => (
                  <Icon
                    name="times"
                    aria-label={t('logs.log-line-details.remove-log', 'Remove log')}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDetails(log);
                    }}
                  />
                )}
              />
            );
          })}
        </TabsBar>
      )}
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
  );
};

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
});
