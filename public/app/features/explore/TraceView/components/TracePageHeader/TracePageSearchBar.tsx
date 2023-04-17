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
import cx from 'classnames';
import React, { memo, Dispatch, SetStateAction } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2 } from '@grafana/ui';

import SearchBarInput from '../common/SearchBarInput';
import { ubFlexAuto, ubJustifyEnd } from '../uberUtilityStyles';

// eslint-disable-next-line no-duplicate-imports

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    TracePageSearchBar: css`
      label: TracePageSearchBar;
      float: right;
      position: absolute;
      top: 0;
      right: 0;
      z-index: ${theme.zIndex.navbarFixed};
      background: ${theme.colors.background.primary};
      margin-bottom: -48px;
      padding: 8px;
      margin-right: 2px;
      border-radius: ${theme.shape.radius.default};
      box-shadow: ${theme.shadows.z2};
    `,
    TracePageSearchBarBar: css`
      label: TracePageSearchBarBar;
      max-width: 20rem;
      transition: max-width 0.5s;
      &:focus-within {
        max-width: 100%;
      }
    `,
    TracePageSearchBarSuffix: css`
      label: TracePageSearchBarSuffix;
      opacity: 0.6;
    `,
    TracePageSearchBarBtn: css`
      label: TracePageSearchBarBtn;
      transition: 0.2s;
      margin-left: 8px;
    `,
    TracePageSearchBarBtnDisabled: css`
      label: TracePageSearchBarBtnDisabled;
      opacity: 0.5;
    `,
    TracePageSearchBarLocateBtn: css`
      label: TracePageSearchBarLocateBtn;
      padding: 1px 8px 4px;
    `,
  };
};

export type TracePageSearchBarProps = {
  navigable: boolean;
  searchValue: string;
  setSearch: (value: string) => void;
  searchBarSuffix: string;
  spanFindMatches: Set<string> | undefined;
  focusedSpanIdForSearch: string;
  setSearchBarSuffix: Dispatch<SetStateAction<string>>;
  setFocusedSpanIdForSearch: Dispatch<SetStateAction<string>>;
  datasourceType: string;
};

export default memo(function TracePageSearchBar(props: TracePageSearchBarProps) {
  const {
    navigable,
    setSearch,
    searchValue,
    searchBarSuffix,
    spanFindMatches,
    focusedSpanIdForSearch,
    setSearchBarSuffix,
    setFocusedSpanIdForSearch,
    datasourceType,
  } = props;
  const styles = useStyles2(getStyles);

  const suffix = searchValue ? (
    <span className={styles.TracePageSearchBarSuffix} aria-label="Search bar suffix">
      {searchBarSuffix}
    </span>
  ) : null;

  const btnClass = cx(styles.TracePageSearchBarBtn, { [styles.TracePageSearchBarBtnDisabled]: !searchValue });
  const SearchBarInputProps = {
    className: cx(styles.TracePageSearchBarBar, ubFlexAuto),
    name: 'search',
    suffix,
  };

  const setTraceSearch = (value: string) => {
    setFocusedSpanIdForSearch('');
    setSearchBarSuffix('');
    setSearch(value);
  };

  const nextResult = () => {
    reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      direction: 'next',
    });

    const spanMatches = Array.from(spanFindMatches!);
    const prevMatchedIndex = spanMatches.indexOf(focusedSpanIdForSearch)
      ? spanMatches.indexOf(focusedSpanIdForSearch)
      : 0;

    // new query || at end, go to start
    if (prevMatchedIndex === -1 || prevMatchedIndex === spanMatches.length - 1) {
      setFocusedSpanIdForSearch(spanMatches[0]);
      setSearchBarSuffix(getSearchBarSuffix(1));
      return;
    }

    // get next
    setFocusedSpanIdForSearch(spanMatches[prevMatchedIndex + 1]);
    setSearchBarSuffix(getSearchBarSuffix(prevMatchedIndex + 2));
  };

  const prevResult = () => {
    reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
      datasourceType: datasourceType,
      grafana_version: config.buildInfo.version,
      direction: 'prev',
    });

    const spanMatches = Array.from(spanFindMatches!);
    const prevMatchedIndex = spanMatches.indexOf(focusedSpanIdForSearch)
      ? spanMatches.indexOf(focusedSpanIdForSearch)
      : 0;

    // new query || at start, go to end
    if (prevMatchedIndex === -1 || prevMatchedIndex === 0) {
      setFocusedSpanIdForSearch(spanMatches[spanMatches.length - 1]);
      setSearchBarSuffix(getSearchBarSuffix(spanMatches.length));
      return;
    }

    // get prev
    setFocusedSpanIdForSearch(spanMatches[prevMatchedIndex - 1]);
    setSearchBarSuffix(getSearchBarSuffix(prevMatchedIndex));
  };

  const getSearchBarSuffix = (index: number): string => {
    if (spanFindMatches?.size && spanFindMatches?.size > 0) {
      return index + ' of ' + spanFindMatches?.size;
    }
    return '';
  };

  return (
    <div className={styles.TracePageSearchBar}>
      <span className={ubJustifyEnd} style={{ display: 'flex' }}>
        <SearchBarInput
          onChange={setTraceSearch}
          value={searchValue}
          inputProps={SearchBarInputProps}
          allowClear={true}
        />
        <>
          {navigable && (
            <>
              <Button
                className={btnClass}
                variant="secondary"
                disabled={!searchValue}
                type="button"
                icon="arrow-down"
                aria-label="Next results button"
                onClick={nextResult}
              />
              <Button
                className={btnClass}
                variant="secondary"
                disabled={!searchValue}
                type="button"
                icon="arrow-up"
                aria-label="Prev results button"
                onClick={prevResult}
              />
            </>
          )}
        </>
      </span>
    </div>
  );
});
