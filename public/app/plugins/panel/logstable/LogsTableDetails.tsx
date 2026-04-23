import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useState, useCallback, startTransition, useRef, useMemo, useEffect } from 'react';

import {
  type PanelProps,
  type GrafanaTheme2,
  type TimeRange,
  LogsDedupStrategy,
  store,
  LogsSortOrder,
  CoreApp,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDragStyles, Icon, ScrollContainer, Tab, TabsBar, usePanelContext, useStyles2 } from '@grafana/ui';
import { LogLineDetailsComponent } from 'app/features/logs/components/panel/LogLineDetailsComponent';
import { LogLineDetailsHeader } from 'app/features/logs/components/panel/LogLineDetailsHeader';
import { LogListContextProvider } from 'app/features/logs/components/panel/LogListContext';

import { useLogDetailsContext } from './LogDetailsContext';
import { SETTING_KEY_ROOT } from './constants';
import { type Options } from './options/types';
import { isCoreApp, isIsLabelFilterActive } from './types';

interface Props extends Pick<PanelProps<Options>, 'onOptionsChange'> {
  options: Options;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogsTableDetails = ({ options, onOptionsChange, timeRange, timeZone }: Props) => {
  const { currentLog, closeDetails, enableLogDetails, logs, setCurrentLog, showDetails, toggleDetails } =
    useLogDetailsContext();
  const [search, setSearch] = useState('');
  const [detailsWidth, setDetailsWidth] = useState(options.logDetailsWidth ?? getDefaultLogDetailsWidth());
  const { onAddAdHocFilter, app } = usePanelContext();
  const inputRef = useRef('');
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles);

  useEffect(() => {
    function handleClose(event: KeyboardEvent) {
      if (event.key === 'Escape' && showDetails.length > 0) {
        closeDetails();
      }
    }
    document.addEventListener('keyup', handleClose);
    return () => {
      document.removeEventListener('keyup', handleClose);
    };
  }, [closeDetails, showDetails.length]);

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

  const handleFilterFor = useCallback(
    (key: string, value: string) => {
      onAddAdHocFilter?.({
        key,
        value,
        operator: '=',
      });
    },
    [onAddAdHocFilter]
  );

  const handleFilterOut = useCallback(
    (key: string, value: string) => {
      onAddAdHocFilter?.({
        key,
        value,
        operator: '!=',
      });
    },
    [onAddAdHocFilter]
  );

  if (!enableLogDetails || !currentLog) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Resizable
        onResizeStop={handleResize}
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
          <LogListContextProvider
            app={isCoreApp(app) ? app : CoreApp.Unknown}
            isLabelFilterActive={
              isIsLabelFilterActive(options.isLabelFilterActive) ? options.isLabelFilterActive : undefined
            }
            onClickFilterLabel={handleFilterFor}
            onClickFilterOutLabel={handleFilterOut}
            dedupStrategy={LogsDedupStrategy.none}
            displayedFields={[]}
            fontSize={store.get(`${SETTING_KEY_ROOT}.fontSize`) ?? 'default'}
            logs={logs}
            showControls={false}
            showTime={false}
            sortOrder={LogsSortOrder.Ascending}
            wrapLogMessage
          >
            <LogLineDetailsHeader
              closeDetails={closeDetails}
              detailsMode="sidebar"
              log={currentLog}
              search={search}
              onSearch={handleSearch}
            />
            <ScrollContainer>
              <LogLineDetailsComponent
                log={currentLog}
                logs={logs}
                search={search}
                timeRange={timeRange}
                timeZone={timeZone}
              />
            </ScrollContainer>
          </LogListContextProvider>
        </div>
      </Resizable>
    </div>
  );
};

export function getDefaultLogDetailsWidth() {
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
    zIndex: theme.zIndex.navbarFixed,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
});
