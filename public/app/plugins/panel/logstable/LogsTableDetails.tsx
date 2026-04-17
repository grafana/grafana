import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useState, useCallback, startTransition, useRef, useMemo } from 'react';

import { type PanelProps, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDragStyles, Icon, ScrollContainer, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { LogLineDetailsComponent } from 'app/features/logs/components/panel/LogLineDetailsComponent';
import { LogLineDetailsHeader } from 'app/features/logs/components/panel/LogLineDetailsHeader';

import { useLogDetailsContext } from './LogDetailsContext';
import { type Options } from './options/types';

interface Props extends Pick<PanelProps<Options>, 'onOptionsChange'> {
  options: Options;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogsTableDetails = ({ options, onOptionsChange, timeRange, timeZone }: Props) => {
  const { currentLog, enableLogDetails, logs, setCurrentLog, showDetails, toggleDetails } = useLogDetailsContext();
  const [search, setSearch] = useState('');
  const [detailsWidth, setDetailsWidth] = useState(window.innerWidth * 0.4);
  const inputRef = useRef('');
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles);

  const handleSearch = useCallback((newSearch: string) => {
    inputRef.current = newSearch;
    startTransition(() => {
      setSearch(inputRef.current);
    });
  }, []);

  const tabs = useMemo(() => showDetails.slice().reverse(), [showDetails]);

  const handleResize = useCallback(
    (event: unknown, direction: unknown, elementRef: HTMLElement) => {
      const width = elementRef.clientWidth;
      setDetailsWidth(width);
      onOptionsChange({
        ...options,
        logDetailsWidth: width,
      });
    },
    [onOptionsChange, options]
  );

  if (!enableLogDetails || !currentLog) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Resizable
        onResize={handleResize}
        handleClasses={{ left: dragStyles.dragHandleVertical }}
        defaultSize={{ width: detailsWidth, height: '100%' }}
        size={{ width: detailsWidth, height: '100%' }}
        enable={{ left: true }}
        minWidth={40}
      >
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
      </Resizable>
    </div>
  );
};

export function getLogDetailsWidth() {
  return Math.max(Math.round(window.innerWidth * 0.4), 400);
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'absolute',
    top: 0,
    right: 0,
    height: '100%',
  }),
  container: css({
    backgroundColor: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    zIndex: 99999,
    height: '100%',
  }),
});
