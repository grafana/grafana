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
import React, { memo, Dispatch, SetStateAction, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Switch, useStyles2 } from '@grafana/ui';
import { getButtonStyles } from '@grafana/ui/src/components/Button';

import { SearchProps } from '../../../useSearch';
import { Trace } from '../../types';
import { convertTimeFilter } from '../../utils/filter-spans';

import NextPrevResult from './NextPrevResult';

export type TracePageSearchBarProps = {
  trace: Trace;
  search: SearchProps;
  spanFilterMatches: Set<string> | undefined;
  showSpanFilterMatchesOnly: boolean;
  setShowSpanFilterMatchesOnly: (showMatchesOnly: boolean) => void;
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
    showSpanFilterMatchesOnly,
    setShowSpanFilterMatchesOnly,
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
      showSpanFilterMatchesOnly
    );
  }, [search.serviceName, search.spanName, search.from, search.to, search.tags, showSpanFilterMatchesOnly]);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
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
              <Button
                onClick={() => setShowSpanFilterMatchesOnly(!showSpanFilterMatchesOnly)}
                className={styles.clearMatchesButton}
                variant="secondary"
                fill="text"
              >
                Show matches only
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
    container: css`
      display: inline;
    `,
    controls: css`
      display: flex;
      justify-content: flex-end;
      margin: 5px 0 0 0;
    `,
    clearButton: css`
      order: 1;
    `,
    matchesOnly: css`
      display: inline-flex;
      margin: 0 0 0 25px;
      vertical-align: middle;
      align-items: center;

      span {
        cursor: pointer;
      }
    `,
    clearMatchesButton: css`
      color: ${theme.colors.text.primary};
      &:hover {
        background: inherit;
        color: inherit;
      }
    `,
    nextPrevResult: css`
      margin-left: auto;
      order: 2;
    `,
  };
};
