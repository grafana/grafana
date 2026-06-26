// Copyright (c) 2017 Uber Technologies, Inc.
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
import { groupBy as _groupBy } from 'lodash';
import { useState } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { autoColor } from '../Theme';
import { Popover } from '../common/Popover';
import type TNil from '../types/TNil';
import { type TraceSpan, type CriticalPathSection } from '../types/trace';
import { getSummaryDurationStats } from '../utils/summary-span';

import AccordianLogs from './SpanDetail/AccordianLogs';
import { type ViewedBoundsFunctionType } from './utils';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      label: 'wrapper',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      overflow: 'hidden',
      zIndex: 0,
    }),
    bar: css({
      label: 'bar',
      borderRadius: theme.shape.radius.sm,
      minWidth: '2px',
      position: 'absolute',
      height: '40%',
      top: '30%',
    }),
    // Decorative light-to-dark gradient within the service hue marking a span as a
    // pruned summary (an aggregate of many spans spanning a time window), not a
    // single operation. It does not encode histogram or timing data. The service
    // color is threaded in via the `--span-summary-color` custom property set on
    // the bar; `backgroundColor` (set inline, longhand) is the solid fallback if
    // color-mix is unsupported.
    barSummary: css({
      label: 'barSummary',
      backgroundImage: `linear-gradient(
        90deg,
        color-mix(in srgb, var(--span-summary-color), white 30%) 0%,
        var(--span-summary-color) 38%,
        color-mix(in srgb, var(--span-summary-color), black 55%) 100%
      )`,
    }),
    rpc: css({
      label: 'rpc',
      position: 'absolute',
      top: '35%',
      bottom: '35%',
      zIndex: 1,
    }),
    label: css({
      label: 'label',
      color: '#aaa',
      fontSize: '12px',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans - serif",
      lineHeight: '1em',
      whiteSpace: 'nowrap',
      padding: '0 0.5em',
      position: 'absolute',
    }),
    logMarker: css({
      label: 'logMarker',
      backgroundColor: autoColor(theme, '#2c3235'),
      cursor: 'pointer',
      height: '60%',
      minWidth: '1px',
      position: 'absolute',
      top: '20%',
      '&:hover': {
        backgroundColor: autoColor(theme, '#464c54'),
      },
      '&::before, &::after': {
        content: "''",
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        border: '1px solid transparent',
      },
      '&::after': {
        left: 0,
      },
    }),
    criticalPath: css({
      position: 'absolute',
      top: '44%',
      height: '11%',
      zIndex: 2,
      overflow: 'hidden',
      background: autoColor(theme, '#f1f1f1'),
      borderLeft: `1px solid ${autoColor(theme, '#2c3235')}`,
      borderRight: `1px solid ${autoColor(theme, '#2c3235')}`,
    }),
  };
};

export type Props = {
  color: string;
  onClick?: (evt: React.MouseEvent<HTMLDivElement>) => void;
  viewEnd: number;
  viewStart: number;
  getViewedBounds: ViewedBoundsFunctionType;
  rpc:
    | {
        viewStart: number;
        viewEnd: number;
        color: string;
      }
    | TNil;
  traceStartTime: number;
  span: TraceSpan;
  className?: string;
  labelClassName?: string;
  longLabel: string;
  shortLabel: string;
  // Service::operation text revealed on hover. For summary spans it is rendered
  // as a sibling of the stats label (not merged into it) so the stats stay
  // permanently visible while the detail expands.
  labelDetail: string;
  criticalPath: CriticalPathSection[];
};

function toPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function toPercentInDecimal(value: number) {
  return `${value * 100}%`;
}

function SpanBar({
  criticalPath,
  viewEnd,
  viewStart,
  getViewedBounds,
  color,
  shortLabel,
  longLabel,
  labelDetail,
  onClick,
  rpc,
  traceStartTime,
  span,
  className,
  labelClassName,
}: Props) {
  const summaryStats = span.aggregation?.isSummary ? getSummaryDurationStats(span.aggregation) : null;

  const [expanded, setExpanded] = useState(false);
  const collapse = () => setExpanded(false);
  const expand = () => setExpanded(true);
  // Normal spans swap the whole label text on hover. Summary spans instead keep
  // a fixed stats label and reveal the service::operation detail as a sibling,
  // so the stats stay permanently visible. The detail goes before the stats
  // when the label sits left of the bar (bar near the right edge), after it
  // otherwise, matching the long-label order used elsewhere.
  const normalLabel = expanded ? longLabel : shortLabel;
  const detailBeforeStats = viewStart > 1 - viewEnd;

  // group logs based on timestamps
  const logGroups = _groupBy(span.logs, (log) => {
    const posPercent = getViewedBounds(log.timestamp, log.timestamp).start;
    // round to the nearest 0.2%
    return toPercent(Math.round(posPercent * 500) / 500);
  });
  const styles = useStyles2(getStyles);

  // backgroundColor (longhand, not the `background` shorthand) so it does not reset
  // the barSummary class's background-image; it also acts as the solid fallback.
  // The summary gradient reads the color from the --span-summary-color custom prop.
  const barStyle: React.CSSProperties & Record<string, string | number> = {
    backgroundColor: color,
    left: toPercent(viewStart),
    width: toPercent(viewEnd - viewStart),
    ...(span.aggregation?.isSummary ? { '--span-summary-color': color } : {}),
  };

  return (
    <div
      className={cx(styles.wrapper, className)}
      onBlur={collapse}
      onClick={onClick}
      onFocus={expand}
      onMouseOut={collapse}
      onMouseOver={expand}
      aria-hidden
      data-testid={selectors.components.TraceViewer.spanBar}
    >
      <div
        aria-label={summaryStats ? shortLabel : normalLabel}
        className={cx(styles.bar, { [styles.barSummary]: span.aggregation?.isSummary })}
        data-testid="SpanBar--bar"
        style={barStyle}
      >
        {summaryStats ? (
          <div className={cx(styles.label, labelClassName)} data-testid="SpanBar--label">
            {expanded && detailBeforeStats && (
              <span>
                {labelDetail}
                {' | '}
              </span>
            )}
            <span>{shortLabel}</span>
            {expanded && !detailBeforeStats && (
              <span>
                {' | '}
                {labelDetail}
              </span>
            )}
          </div>
        ) : (
          <div className={cx(styles.label, labelClassName)} data-testid="SpanBar--label">
            {normalLabel}
          </div>
        )}
      </div>
      <div>
        {Object.keys(logGroups).map((positionKey) => (
          <Popover
            key={positionKey}
            content={
              <AccordianLogs interactive={false} isOpen logs={logGroups[positionKey]} timestamp={traceStartTime} />
            }
          >
            <div data-testid="SpanBar--logMarker" className={cx(styles.logMarker)} style={{ left: positionKey }} />
          </Popover>
        ))}
      </div>
      {rpc && (
        <div
          className={cx(styles.rpc)}
          style={{
            background: rpc.color,
            left: toPercent(rpc.viewStart),
            width: toPercent(rpc.viewEnd - rpc.viewStart),
          }}
        />
      )}
      {criticalPath?.map((each, index) => {
        const critcalPathViewBounds = getViewedBounds(each.section_start, each.section_end);
        const criticalPathViewStart = critcalPathViewBounds.start;
        const criticalPathViewEnd = critcalPathViewBounds.end;
        const key = `${each.spanId}-${index}`;
        return (
          <Tooltip
            key={key}
            placement="top"
            content={
              <div>
                <Trans i18nKey="explore.span-bar.tooltip-critical-path">
                  A segment on the <em>critical path</em> of the overall trace / request / workflow.
                </Trans>
              </div>
            }
          >
            <div
              data-testid="SpanBar--criticalPath"
              className={styles.criticalPath}
              style={{
                left: toPercentInDecimal(criticalPathViewStart),
                width: toPercentInDecimal(criticalPathViewEnd - criticalPathViewStart),
              }}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}

export default React.memo(SpanBar);
