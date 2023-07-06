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
import React, { memo, Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';

import { config, reportInteraction } from '@grafana/runtime';
import { Button, Icon, Switch, Tooltip, useStyles2 } from '@grafana/ui';

import { SearchProps } from '../../useSearch';
import { convertTimeFilter } from '../utils/filter-spans';

export type TracePageSearchBarProps = {
  search: SearchProps;
  spanFilterMatches: Set<string> | undefined;
  showSpanFilterMatchesOnly: boolean;
  setShowSpanFilterMatchesOnly: (showMatchesOnly: boolean) => void;
  setFocusedSpanIdForSearch: Dispatch<SetStateAction<string>>;
  datasourceType: string;
  clear: () => void;
  totalSpans: number;
};

export default memo(function NewTracePageSearchBar(props: TracePageSearchBarProps) {
  const {
    search,
    spanFilterMatches,
    showSpanFilterMatchesOnly,
    setShowSpanFilterMatchesOnly,
    setFocusedSpanIdForSearch,
    datasourceType,
    clear,
    totalSpans,
  } = props;
  const [currentSpanIndex, setCurrentSpanIndex] = useState(-1);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setCurrentSpanIndex(-1);
    setFocusedSpanIdForSearch('');
  }, [setFocusedSpanIdForSearch, spanFilterMatches]);

  useEffect(() => {
    if (spanFilterMatches) {
      const spanMatches = Array.from(spanFilterMatches!);
      setFocusedSpanIdForSearch(spanMatches[currentSpanIndex]);
    }
  }, [currentSpanIndex, setFocusedSpanIdForSearch, spanFilterMatches]);

  const nextResult = () => {
    reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      direction: 'next',
    });

    // new query || at end, go to start
    if (currentSpanIndex === -1 || (spanFilterMatches && currentSpanIndex === spanFilterMatches.size - 1)) {
      setCurrentSpanIndex(0);
      return;
    }

    // get next
    setCurrentSpanIndex(currentSpanIndex + 1);
  };

  const prevResult = () => {
    reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      direction: 'prev',
    });

    // new query || at start, go to end
    if (spanFilterMatches && (currentSpanIndex === -1 || currentSpanIndex === 0)) {
      setCurrentSpanIndex(spanFilterMatches.size - 1);
      return;
    }

    // get prev
    setCurrentSpanIndex(currentSpanIndex - 1);
  };

  const buttonEnabled = spanFilterMatches && spanFilterMatches?.size > 0;
  const clearEnabled = useMemo(() => {
    return (
      (search.serviceName && search.serviceName !== '') ||
      (search.spanName && search.spanName !== '') ||
      convertTimeFilter(search.from || '') ||
      convertTimeFilter(search.to || '') ||
      search.tags.length > 1 ||
      search.tags.some((tag) => {
        return tag.key;
      })
    );
  }, [search.serviceName, search.spanName, search.from, search.to, search.tags]);

  const amountText = spanFilterMatches?.size === 1 ? 'match' : 'matches';
  const matches =
    spanFilterMatches?.size === 0 ? (
      <>
        <span>0 matches</span>
        <Tooltip
          content="There are 0 span matches for the filters selected. Please try removing some of the selected filters."
          placement="left"
        >
          <span className={styles.matchesTooltip}>
            <Icon name="info-circle" size="lg" />
          </span>
        </Tooltip>
      </>
    ) : currentSpanIndex !== -1 ? (
      `${currentSpanIndex + 1}/${spanFilterMatches?.size} ${amountText}`
    ) : (
      `${spanFilterMatches?.size} ${amountText}`
    );

  return (
    <div className={styles.searchBar}>
      <div className={styles.buttons}>
        <>
          <div className={styles.clearButton}>
            <Button
              variant="destructive"
              disabled={!clearEnabled}
              type="button"
              fill="outline"
              aria-label="Clear filters button"
              onClick={clear}
            >
              Clear
            </Button>
            <div className={styles.matchesOnly}>
              <Switch
                value={showSpanFilterMatchesOnly}
                onChange={(value) => setShowSpanFilterMatchesOnly(value.currentTarget.checked ?? false)}
                label="Show matches only switch"
              />
              {/* TODO: fix keyboard a11y */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <span onClick={() => setShowSpanFilterMatchesOnly(!showSpanFilterMatchesOnly)}>Show matches only</span>
            </div>
          </div>
          <div className={styles.nextPrevButtons}>
            <span className={styles.matches}>{spanFilterMatches ? matches : `${totalSpans} spans`}</span>
            <Button
              variant="secondary"
              disabled={!buttonEnabled}
              type="button"
              fill="outline"
              aria-label="Prev result button"
              onClick={prevResult}
            >
              Prev
            </Button>
            <Button
              variant="secondary"
              disabled={!buttonEnabled}
              type="button"
              fill="outline"
              aria-label="Next result button"
              onClick={nextResult}
            >
              Next
            </Button>
          </div>
        </>
      </div>
    </div>
  );
});

export const getStyles = () => {
  return {
    searchBar: css`
      display: inline;
    `,
    matchesOnly: css`
      display: inline-flex;
      margin: 0 0 0 10px;
      vertical-align: middle;

      span {
        cursor: pointer;
        margin: -3px 0 0 5px;
      }
    `,
    buttons: css`
      display: flex;
      justify-content: flex-end;
      margin: 5px 0 0 0;
    `,
    clearButton: css`
      order: 1;
    `,
    nextPrevButtons: css`
      margin-left: auto;
      order: 2;

      button {
        margin-left: 8px;
      }
    `,
    matches: css`
      margin-right: 5px;
    `,
    matchesTooltip: css`
      color: #aaa;
      margin: -2px 0 0 10px;
    `,
  };
};
