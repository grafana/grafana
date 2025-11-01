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
import { get, maxBy, values } from 'lodash';
import { memo, Dispatch, SetStateAction, useEffect, useCallback } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Icon, PopoverContent, Tooltip, useTheme2 } from '@grafana/ui';

import { Trace } from '../../types/trace';

export type NextPrevResultProps = {
  trace: Trace;
  spanFilterMatches: Set<string> | undefined;
  setFocusedSpanIdForSearch: Dispatch<SetStateAction<string>>;
  focusedSpanIndexForSearch: number;
  setFocusedSpanIndexForSearch: Dispatch<SetStateAction<number>>;
  datasourceType: string;
  showSpanFilters: boolean;
};

export default memo(function NextPrevResult(props: NextPrevResultProps) {
  const {
    trace,
    spanFilterMatches,
    setFocusedSpanIdForSearch,
    focusedSpanIndexForSearch,
    setFocusedSpanIndexForSearch,
    datasourceType,
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

  const getTooltip = useCallback(
    (content: PopoverContent) => {
      return (
        <Tooltip content={content} placement="top">
          <span className={styles.tooltip}>
            <Icon name="info-circle" size="sm" />
          </span>
        </Tooltip>
      );
    },
    [styles.tooltip]
  );

  const getMatchesMetadata = useCallback(
    (depth: number, services: number) => {
      let metadata = (
        <>
          <span>{`${trace.spans.length} spans`}</span>
          {getTooltip(
            <>
              <div>
                <Trans i18nKey="explore.next-prev-result.services">Services: {{ services }}</Trans>
              </div>
              <div>
                <Trans i18nKey="explore.next-prev-result.depth">Depth: {{ depth }}</Trans>
              </div>
            </>
          )}
        </>
      );

      if (spanFilterMatches) {
        if (spanFilterMatches.size === 0) {
          metadata = (
            <>
              <span>
                <Trans i18nKey="explore.get-matches-metadata.matches">0 matches</Trans>
              </span>
              {getTooltip(
                'There are 0 span matches for the filters selected. Please try removing some of the selected filters.'
              )}
            </>
          );
        } else {
          const type = spanFilterMatches.size === 1 ? 'match' : 'matches';
          const text =
            focusedSpanIndexForSearch !== -1
              ? `${focusedSpanIndexForSearch + 1}/${spanFilterMatches.size} ${type}`
              : `${spanFilterMatches.size} ${type}`;

          const matchedServices: string[] = [];
          spanFilterMatches.forEach((spanID) => {
            if (trace.processes[spanID]) {
              matchedServices.push(trace.processes[spanID].serviceName);
            }
          });

          metadata = (
            <>
              <span>{text}</span>
              {getTooltip(
                <>
                  <div>
                    <Trans
                      i18nKey="explore.next-prev-result.services-span-filter-matches"
                      values={{ total: new Set(matchedServices).size }}
                    >
                      Services: {'{{total}}'}/{{ services }}
                    </Trans>
                  </div>
                  <div>
                    <Trans i18nKey="explore.next-prev-result.depth-span-filter-matches">Depth: {{ depth }}</Trans>
                  </div>
                </>
              )}
            </>
          );
        }
      }

      return metadata;
    },
    [focusedSpanIndexForSearch, getTooltip, spanFilterMatches, trace.processes, trace.spans]
  );

  const services = new Set(values(trace.processes).map((p) => p.serviceName)).size;
  const depth = get(maxBy(trace.spans, 'depth'), 'depth', 0) + 1;

  return (
    <div className={styles.container}>
      <div className={buttonEnabled ? styles.buttons : cx(styles.buttons, styles.buttonsDisabled)}>
        <Button
          aria-label={t('explore.next-prev-result.aria-label-prev', 'Prev result button')}
          variant="secondary"
          size="md"
          icon="arrow-up"
          disabled={!buttonEnabled}
          onClick={(event) => prevResult(event, buttonEnabled)}
          onKeyDown={(event) => prevResultOnKeyDown(event, buttonEnabled)}
          tabIndex={buttonEnabled ? 0 : -1}
        />
        <Button
          aria-label={t('explore.next-prev-result.aria-label-next', 'Next result button')}
          variant="secondary"
          size="md"
          icon="arrow-down"
          disabled={!buttonEnabled}
          onClick={(event) => nextResult(event, buttonEnabled)}
          onKeyDown={(event) => nextResultOnKeyDown(event, buttonEnabled)}
          role="button"
          tabIndex={buttonEnabled ? 0 : -1}
        />
      </div>
      <span className={styles.matches}>{getMatchesMetadata(depth, services)}</span>
    </div>
  );
});

export const getStyles = (theme: GrafanaTheme2, showSpanFilters: boolean) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    buttons: css({
      display: 'inline-flex',
      gap: 1,
    }),
    buttonsDisabled: css({
      cursor: 'not-allowed',
    }),
    button: {
      padding: theme.spacing(0, 1),
    },
    iconButton: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    matches: css({
      textWrap: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    tooltip: css({
      color: '#aaa',
      marginLeft: theme.spacing(0.5),
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
  };
};
