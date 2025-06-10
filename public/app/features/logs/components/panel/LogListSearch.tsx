import { css } from '@emotion/css';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { VariableSizeList } from 'react-window';

import { GrafanaTheme2, shallowCompare } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { IconButton, Input, useStyles2 } from '@grafana/ui';

import { useLogListSearchContext } from './LogListSearchContext';
import { LogListModel } from './processing';

interface Props {
  listRef: VariableSizeList | null;
  logs: LogListModel[];
}

export const LOG_LIST_SEARCH_HEIGHT = 48;
export const LogListSearch = ({ listRef, logs }: Props) => {
  const {
    hideSearch,
    filterLogs,
    matchingUids,
    setMatchingUids,
    setSearch: setContextSearch,
    searchVisible,
    toggleFilterLogs,
  } = useLogListSearchContext();
  const [search, setSearch] = useState('');
  const [currentResult, setCurrentResult] = useState<number | null>(null);
  const styles = useStyles2(getStyles);
  const { t } = useTranslate();

  const matches = useMemo(() => {
    if (!search || !searchVisible) {
      return [];
    }
    const regex = new RegExp(search, 'i');
    const newMatches = logs.filter((log) => log.entry.match(regex) !== null);
    newMatches.forEach((log) => log.setCurrentSearch(search));
    return newMatches;
  }, [logs, search, searchVisible]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setSearch(input);
  }, []);

  const prevResult = useCallback(() => {
    if (currentResult === null) {
      return;
    }
    const prev = currentResult > 0 ? currentResult - 1 : matches.length - 1;
    setCurrentResult(prev);
    listRef?.scrollToItem(logs.indexOf(matches[prev]), 'center');
  }, [currentResult, listRef, logs, matches]);

  const nextResult = useCallback(() => {
    if (currentResult === null) {
      return;
    }
    const next = currentResult < matches.length - 1 ? currentResult + 1 : 0;
    setCurrentResult(next);
    listRef?.scrollToItem(logs.indexOf(matches[next]), 'center');
  }, [currentResult, listRef, logs, matches]);

  useEffect(() => {
    if (!matches.length) {
      setCurrentResult(null);
      return;
    }
    if (!currentResult) {
      setCurrentResult(0);
      listRef?.scrollToItem(logs.indexOf(matches[0]), 'center');
    }
  }, [currentResult, listRef, logs, matches]);

  useEffect(() => {
    if (!searchVisible) {
      setSearch('');
      setContextSearch(undefined);
      setMatchingUids(null);
    }
  }, [searchVisible, setContextSearch, setMatchingUids]);

  useEffect(() => {
    const newMatchingUids = matches.map((log) => log.uid);

    if (matchingUids && !shallowCompare(matchingUids, newMatchingUids)) {
      // Cleanup previous matches
      logs
        .filter((log) => matchingUids.includes(log.uid))
        .filter((prevMatchingLog) => matches.findIndex((matchingLog) => matchingLog.uid === prevMatchingLog.uid) < 0)
        .forEach((log) => log.setCurrentSearch(undefined));
    }

    setContextSearch(search ? search : undefined);
    setMatchingUids(newMatchingUids.length ? newMatchingUids : null);
  }, [logs, matches, matchingUids, search, setContextSearch, setMatchingUids]);

  if (!searchVisible) {
    return null;
  }

  const suffix =
    search !== '' ? <>{`${currentResult !== null ? currentResult + 1 : 0}/${matches?.length ?? 0}`}</> : undefined;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <Input
          value={search}
          onChange={handleChange}
          autoFocus
          placeholder={t('logs.log-list-search.input-placeholder', 'Search in logs')}
          suffix={suffix}
        />
      </div>
      <IconButton
        name="info-circle"
        variant="secondary"
        tooltip={t(
          'logs.log-list-search.info',
          'Client-side search for strings within the displayed logs. Not to be confused with query filters—use this component to search for specific strings in your log results.'
        )}
      />
      <IconButton
        onClick={prevResult}
        disabled={!matches || !matches.length}
        name="angle-up"
        aria-label={t('logs.log-list-search.prev', 'Previous result')}
      />
      <IconButton
        onClick={nextResult}
        disabled={!matches || !matches.length}
        name="angle-down"
        aria-label={t('logs.log-list-search.next', 'Next result')}
      />
      <IconButton
        onClick={toggleFilterLogs}
        disabled={!matches || !matches.length}
        className={filterLogs ? styles.controlButtonActive : undefined}
        name="filter"
        aria-label={t('logs.log-list-search.filter', 'Filter matching logs')}
      />
      <IconButton onClick={hideSearch} name="times" aria-label={t('logs.log-list-search.close', 'Close search')} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: theme.colors.background.canvas,
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    zIndex: theme.zIndex.modal,
    overflow: 'hidden',
    width: '100%',
  }),
  wrapper: css({
    width: '50%',
  }),
  controlButtonActive: css({
    '&:after': {
      display: 'block',
      content: '" "',
      position: 'absolute',
      height: 2,
      borderRadius: theme.shape.radius.default,
      bottom: 2,
      backgroundImage: theme.colors.gradients.brandHorizontal,
      width: '95%',
      opacity: 1,
    },
  }),
});
