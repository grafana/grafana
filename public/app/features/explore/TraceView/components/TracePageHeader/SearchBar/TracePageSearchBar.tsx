// Copyright (c) 2018 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css } from '@emotion/css';
import { memo, Dispatch, SetStateAction, useMemo } from 'react';

import { GrafanaTheme2, TraceSearchProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Switch, useStyles2 } from '@grafana/ui';
import { getButtonStyles } from '@grafana/ui/internal';

import { Trace } from '../../types/trace';
import { convertTimeFilter } from '../../utils/filter-spans';

import NextPrevResult from './NextPrevResult';

export type TracePageSearchBarProps = {
  trace: Trace;
  search: TraceSearchProps;
  spanFilterMatches: Set<string> | undefined;
  setShowSpanFilterMatchesOnly: (showMatchesOnly: boolean) => void;
  setShowCriticalPathSpansOnly: (showCriticalPath: boolean) => void;
  focusedSpanIndexForSearch: number;
  setFocusedSpanIndexForSearch: Dispatch<SetStateAction<number>>;
  setFocusedSpanIdForSearch: Dispatch<SetStateAction<string>>;
  datasourceType: string;
  clear: () => void;
  showSpanFilters: boolean;
};

export default memo(function TracePageSearchBar(props: TracePageSearchBarProps) {
  const {
    trace,
    search,
    spanFilterMatches,
    setShowSpanFilterMatchesOnly,
    setShowCriticalPathSpansOnly,
    focusedSpanIndexForSearch,
    setFocusedSpanIndexForSearch,
    setFocusedSpanIdForSearch,
    datasourceType,
    clear,
    showSpanFilters,
  } = props;
  const styles = useStyles2(getStyles);

  const clearEnabled = useMemo(() => {
    return (
      (search.serviceName && search.serviceName !== '') ||
      (search.spanName && search.spanName !== '') ||
      convertTimeFilter(search.from || '') ||
      convertTimeFilter(search.to || '') ||
      search.tags.length > 1 ||
      search.tags.some((tag) => {
        return tag.key;
      }) ||
      (search.query && search.query !== '') ||
      search.matchesOnly
    );
  }, [search.serviceName, search.spanName, search.from, search.to, search.tags, search.query, search.matchesOnly]);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <>
          <div>
            <Button
              variant="destructive"
              disabled={!clearEnabled}
              type="button"
              fill="outline"
              aria-label={t('explore.trace-page-search-bar.aria-label-clear-filters', 'Clear filters button')}
              onClick={clear}
            >
              <Trans i18nKey="explore.clear">Clear</Trans>
            </Button>
            <div className={styles.matchesOnly}>
              <Switch
                value={search.matchesOnly}
                onChange={(value) => setShowSpanFilterMatchesOnly(value.currentTarget.checked ?? false)}
                label={t('explore.trace-page-search-bar.label-show-matches', 'Show matches only switch')}
                disabled={!spanFilterMatches?.size}
              />
              <Button
                onClick={() => setShowSpanFilterMatchesOnly(!search.matchesOnly)}
                className={styles.clearMatchesButton}
                variant="secondary"
                fill="text"
                disabled={!spanFilterMatches?.size}
              >
                <Trans i18nKey="explore.show-matches-only">Show matches only</Trans>
              </Button>
            </div>
            <div className={styles.matchesOnly}>
              <Switch
                value={search.criticalPathOnly}
                onChange={(value) => setShowCriticalPathSpansOnly(value.currentTarget.checked ?? false)}
                label={t('explore.trace-page-search-bar.label-show-paths', 'Show critical path only switch')}
              />
              <Button
                onClick={() => setShowCriticalPathSpansOnly(!search.criticalPathOnly)}
                className={styles.clearMatchesButton}
                variant="secondary"
                fill="text"
              >
                <Trans i18nKey="explore.show-critical-path-only">Show critical path only</Trans>
              </Button>
            </div>
          </div>
          <div className={styles.nextPrevResult}>
            <NextPrevResult
              trace={trace}
              spanFilterMatches={spanFilterMatches}
              setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
              focusedSpanIndexForSearch={focusedSpanIndexForSearch}
              setFocusedSpanIndexForSearch={setFocusedSpanIndexForSearch}
              datasourceType={datasourceType}
              showSpanFilters={showSpanFilters}
            />
          </div>
        </>
      </div>
    </div>
  );
});

export const getStyles = (theme: GrafanaTheme2) => {
  const buttonStyles = getButtonStyles({ theme, variant: 'secondary', size: 'md', iconOnly: false, fill: 'outline' });

  return {
    button: css(buttonStyles.button),
    buttonDisabled: css(buttonStyles.disabled, { pointerEvents: 'none', cursor: 'not-allowed' }),
    container: css({
      display: 'inline',
    }),
    controls: css({
      display: 'flex',
      justifyContent: 'flex-end',
      margin: '5px 0 0 0',
    }),
    matchesOnly: css({
      display: 'inline-flex',
      margin: '0 0 0 25px',
      verticalAlign: 'middle',
      alignItems: 'center',
    }),
    clearMatchesButton: css({
      color: theme.colors.text.primary,

      '&:hover': {
        background: 'inherit',
      },
    }),
    nextPrevResult: css({
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
    }),
  };
};
