import { css } from '@emotion/css';
import UFuzzy from '@leeoniya/ufuzzy';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { VariableSizeList } from 'react-window';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { IconButton, Input, useStyles2 } from '@grafana/ui';

import { useLogListSearchContext } from './LogListSearchContext';
import { LogListModel } from './processing';

interface Props {
  listRef: VariableSizeList | null;
  logs: LogListModel[];
  width: number;
}

export const LogListSearch = ({ listRef, logs, width }: Props) => {
  const { hideSearch, setSearch: setContextSearch, searchVisible } = useLogListSearchContext();
  const [search, setSearch] = useState('');
  const [currentResult, setCurrentResult] = useState<number | null>(null);
  const styles = useStyles2(getStyles);
  const { t } = useTranslate();

  const filterer = useMemo(() => new UFuzzy({ intraMode: 1 }), []);
  const matches = useMemo(
    () => (search !== '' ? filterer.filter(getHaystack(logs), search) : null),
    [filterer, logs, search]
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setSearch(input);
  }, []);

  const prevResult = useCallback(() => {
    if (!matches || currentResult === null) {
      return;
    }
    const prev = currentResult > 0 ? currentResult - 1 : matches.length - 1;
    setCurrentResult(prev);
    listRef?.scrollToItem(matches[prev], 'center');
  }, [currentResult, listRef, matches]);

  const nextResult = useCallback(() => {
    if (!matches || currentResult === null) {
      return;
    }
    const next = currentResult <= matches.length - 1 ? currentResult + 1 : 0;
    setCurrentResult(next);
    listRef?.scrollToItem(matches[next], 'center');
  }, [currentResult, listRef, matches]);

  useEffect(() => {
    if (!matches || !matches.length) {
      setCurrentResult(null);
      return;
    }
    if (currentResult === null) {
      setCurrentResult(0);
      listRef?.scrollToItem(matches[0], 'center');
    }
  }, [currentResult, listRef, matches]);

  useEffect(() => {
    if (!searchVisible) {
      setSearch('');
    }
  }, [searchVisible]);

  useEffect(() => {
    setContextSearch(search ? search : undefined);
  }, [search, setContextSearch]);

  if (!searchVisible) {
    return null;
  }

  const suffix = search !== '' ? <>{`${currentResult ? currentResult + 1 : 0}/${matches?.length ?? 0}`}</> : undefined;

  return (
    <div className={styles.container} style={{ width: width - 24 }}>
      <div style={{ width: Math.round(width / 2) }}>
        <Input
          value={search}
          onChange={handleChange}
          autoFocus
          placeholder={t('logs.log-list-search.input-placeholder', 'Search in logs')}
          suffix={suffix}
        />
      </div>
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
      <IconButton onClick={hideSearch} name="times" aria-label={t('logs.log-list-search.close', 'Close search')} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: tinycolor(theme.colors.background.canvas).setAlpha(0.8).toRgbString(),
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    position: 'absolute',
    top: 0,
    left: theme.spacing(1),
    zIndex: theme.zIndex.modal,
    overflow: 'hidden',
  }),
});

function getHaystack(logs: LogListModel[]) {
  return logs.map((log) => log.entry);
}
