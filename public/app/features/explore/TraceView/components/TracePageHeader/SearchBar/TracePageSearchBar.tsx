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
import { memo, Dispatch, SetStateAction } from 'react';

import { GrafanaTheme2, TraceSearchProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Switch, useStyles2 } from '@grafana/ui';

import { Trace } from '../../types/trace';

import NextPrevResult from './NextPrevResult';

export type TracePageSearchBarProps = {
  trace: Trace;
  search: TraceSearchProps;
  spanFilterMatches: Set<string> | undefined;
  setShowSpanFilterMatchesOnly: (showMatchesOnly: boolean) => void;
  focusedSpanIndexForSearch: number;
  setFocusedSpanIndexForSearch: Dispatch<SetStateAction<number>>;
  setFocusedSpanIdForSearch: Dispatch<SetStateAction<string>>;
  datasourceType: string;
  showSpanFilters: boolean;
};

export default memo(function TracePageSearchBar(props: TracePageSearchBarProps) {
  const {
    trace,
    search,
    spanFilterMatches,
    setShowSpanFilterMatchesOnly,
    focusedSpanIndexForSearch,
    setFocusedSpanIndexForSearch,
    setFocusedSpanIdForSearch,
    datasourceType,
    showSpanFilters,
  } = props;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.controls}>
      <NextPrevResult
        trace={trace}
        spanFilterMatches={spanFilterMatches}
        setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
        focusedSpanIndexForSearch={focusedSpanIndexForSearch}
        setFocusedSpanIndexForSearch={setFocusedSpanIndexForSearch}
        datasourceType={datasourceType}
        showSpanFilters={showSpanFilters}
      />
      <div
        className={styles.matchesOnly}
        onClick={() => setShowSpanFilterMatchesOnly(!search.matchesOnly)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            setShowSpanFilterMatchesOnly(!search.matchesOnly);
          }
        }}
        role="button"
        tabIndex={0}
      >
        <Switch
          value={!search.matchesOnly}
          onChange={(value) => setShowSpanFilterMatchesOnly(!value.currentTarget.checked)}
          label={t('explore.trace-page-search-bar.label-show-all-spans', 'Show all spans switch')}
          disabled={!spanFilterMatches?.size}
        />
        <span className={styles.clearMatchesButton}>
          <Trans i18nKey="explore.show-all-spans">Show all spans</Trans>
        </span>
      </div>
    </div>
  );
});

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    controls: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(3),
    }),
    matchesOnly: css({
      display: 'inline-flex',
      marginLeft: 'auto',
      verticalAlign: 'middle',
      alignItems: 'center',
      cursor: 'pointer',
      gap: theme.spacing(0.5),
    }),
    clearMatchesButton: css({
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
};
