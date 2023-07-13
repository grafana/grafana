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

import { css, cx } from '@emotion/css';
import React, { memo, Dispatch, SetStateAction, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Icon, Tooltip, useTheme2 } from '@grafana/ui';
import { getButtonStyles } from '@grafana/ui/src/components/Button';

export type NextPrevResultProps = {
  spanFilterMatches: Set<string> | undefined;
  setFocusedSpanIdForSearch: Dispatch<SetStateAction<string>>;
  focusedSpanIndexForSearch: number;
  setFocusedSpanIndexForSearch: Dispatch<SetStateAction<number>>;
  datasourceType: string;
  totalSpans: number;
  showSpanFilters: boolean;
};

export default memo(function NextPrevResult(props: NextPrevResultProps) {
  const {
    spanFilterMatches,
    setFocusedSpanIdForSearch,
    focusedSpanIndexForSearch,
    setFocusedSpanIndexForSearch,
    datasourceType,
    totalSpans,
    showSpanFilters,
  } = props;
  const styles = getStyles(useTheme2(), showSpanFilters);

  useEffect(() => {
    if (spanFilterMatches && focusedSpanIndexForSearch !== -1) {
      const spanMatches = Array.from(spanFilterMatches!);
      setFocusedSpanIdForSearch(spanMatches[focusedSpanIndexForSearch]);
    }
  }, [focusedSpanIndexForSearch, setFocusedSpanIdForSearch, spanFilterMatches]);

  const nextResult = (event: React.UIEvent, buttonEnabled: boolean) => {
    event.preventDefault();
    event.stopPropagation();

    if (buttonEnabled) {
      reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
        datasourceType: datasourceType,
        grafana_version: config.buildInfo.version,
        direction: 'next',
      });

      // new query || at end, go to start
      if (
        focusedSpanIndexForSearch === -1 ||
        (spanFilterMatches && focusedSpanIndexForSearch === spanFilterMatches.size - 1)
      ) {
        setFocusedSpanIndexForSearch(0);
        return;
      }

      // get next
      setFocusedSpanIndexForSearch(focusedSpanIndexForSearch + 1);
    }
  };

  const prevResult = (event: React.UIEvent, buttonEnabled: boolean) => {
    event.preventDefault();
    event.stopPropagation();

    if (buttonEnabled) {
      reportInteraction('grafana_traces_trace_view_find_next_prev_clicked', {
        datasourceType: datasourceType,
        grafana_version: config.buildInfo.version,
        direction: 'prev',
      });

      // new query || at start, go to end
      if (spanFilterMatches && (focusedSpanIndexForSearch === -1 || focusedSpanIndexForSearch === 0)) {
        setFocusedSpanIndexForSearch(spanFilterMatches.size - 1);
        return;
      }

      // get prev
      setFocusedSpanIndexForSearch(focusedSpanIndexForSearch - 1);
    }
  };

  const nextResultOnKeyDown = (event: React.KeyboardEvent, buttonEnabled: boolean) => {
    if (event.key === 'Enter') {
      nextResult(event, buttonEnabled);
    }
  };

  const prevResultOnKeyDown = (event: React.KeyboardEvent, buttonEnabled: boolean) => {
    if (event.key === 'Enter') {
      prevResult(event, buttonEnabled);
    }
  };

  const buttonEnabled = (spanFilterMatches && spanFilterMatches?.size > 0) ?? false;
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
    ) : focusedSpanIndexForSearch !== -1 ? (
      `${focusedSpanIndexForSearch + 1}/${spanFilterMatches?.size} ${amountText}`
    ) : (
      `${spanFilterMatches?.size} ${amountText}`
    );
  const buttonClass = buttonEnabled ? styles.button : cx(styles.button, styles.buttonDisabled);

  return (
    <>
      <span className={styles.matches}>{spanFilterMatches ? matches : `${totalSpans} spans`}</span>
      <div className={buttonEnabled ? styles.buttons : cx(styles.buttons, styles.buttonsDisabled)}>
        <div
          aria-label="Prev result button"
          className={buttonClass}
          onClick={(event) => prevResult(event, buttonEnabled)}
          onKeyDown={(event) => prevResultOnKeyDown(event, buttonEnabled)}
          role="button"
          tabIndex={buttonEnabled ? 0 : -1}
        >
          Prev
        </div>
        <div
          aria-label="Next result button"
          className={buttonClass}
          onClick={(event) => nextResult(event, buttonEnabled)}
          onKeyDown={(event) => nextResultOnKeyDown(event, buttonEnabled)}
          role="button"
          tabIndex={buttonEnabled ? 0 : -1}
        >
          Next
        </div>
      </div>
    </>
  );
});

export const getStyles = (theme: GrafanaTheme2, showSpanFilters: boolean) => {
  const buttonStyles = getButtonStyles({
    theme,
    variant: 'secondary',
    size: showSpanFilters ? 'md' : 'sm',
    iconOnly: false,
    fill: 'outline',
  });

  return {
    buttons: css`
      display: inline-flex;
      gap: 4px;
    `,
    buttonsDisabled: css`
      cursor: not-allowed;
    `,
    button: css`
      ${buttonStyles.button};
    `,
    buttonDisabled: css`
      ${buttonStyles.disabled};
      pointer-events: none;
    `,
    matches: css`
      margin-right: ${theme.spacing(2)};
    `,
    matchesTooltip: css`
      color: #aaa;
      margin: -2px 0 0 10px;
    `,
  };
};
