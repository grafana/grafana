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
import classNames from 'classnames';
import React from 'react';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { TimeZone } from '@grafana/schema';
import { Button, clearButtonStyles, stylesFactory, withTheme2 } from '@grafana/ui';

import { autoColor } from '../Theme';
import { SpanLinkFunc } from '../types';
import { TraceLog, TraceSpan, TraceKeyValuePair, TraceLink, TraceSpanReference } from '../types/trace';

import SpanDetail, { TraceFlameGraphs } from './SpanDetail';
import DetailState from './SpanDetail/DetailState';
import SpanTreeOffset from './SpanTreeOffset';
import TimelineRow from './TimelineRow';

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    expandedAccent: css({
      cursor: 'pointer',
      height: '100%',
      overflow: 'hidden',
      position: 'absolute',
      width: '100%',
      '&::before': {
        borderLeft: '1px solid',
        pointerEvents: 'none',
        width: '1000px',
      },
      '&::after': {
        borderRight: '1000px solid',
        borderColor: 'inherit',
        cursor: 'pointer',
        opacity: 0.2,
      },

      /* border-color inherit must come AFTER other border declarations for accent */
      '&::before, &::after': {
        borderColor: 'inherit',
        content: '" "',
        position: 'absolute',
        height: '100%',
      },

      '&:hover::after': {
        opacity: 0.35,
      },
    }),
    infoWrapper: css({
      label: 'infoWrapper',
      border: `1px solid ${autoColor(theme, '#d3d3d3')}`,
      borderTop: '3px solid',
      padding: '0.75rem',
    }),
  };
});

export type SpanDetailRowProps = {
  color: string;
  columnDivision: number;
  detailState: DetailState;
  onDetailToggled: (spanID: string) => void;
  linksGetter: (span: TraceSpan, links: TraceKeyValuePair[], index: number) => TraceLink[];
  logItemToggle: (spanID: string, log: TraceLog) => void;
  logsToggle: (spanID: string) => void;
  processToggle: (spanID: string) => void;
  referenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  referencesToggle: (spanID: string) => void;
  warningsToggle: (spanID: string) => void;
  stackTracesToggle: (spanID: string) => void;
  span: TraceSpan;
  traceToProfilesOptions?: TraceToProfilesOptions;
  timeZone: TimeZone;
  tagsToggle: (spanID: string) => void;
  traceStartTime: number;
  traceDuration: number;
  traceName: string;
  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  theme: GrafanaTheme2;
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  datasourceType: string;
  visibleSpanIds: string[];
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  setRedrawListView: (redraw: {}) => void;
};

export class UnthemedSpanDetailRow extends React.PureComponent<SpanDetailRowProps> {
  _detailToggle = () => {
    this.props.onDetailToggled(this.props.span.spanID);
  };

  _linksGetter = (items: TraceKeyValuePair[], itemIndex: number) => {
    const { linksGetter, span } = this.props;
    return linksGetter(span, items, itemIndex);
  };

  render() {
    const {
      color,
      columnDivision,
      detailState,
      logItemToggle,
      logsToggle,
      processToggle,
      referenceItemToggle,
      referencesToggle,
      warningsToggle,
      stackTracesToggle,
      span,
      traceToProfilesOptions,
      timeZone,
      tagsToggle,
      traceStartTime,
      traceDuration,
      traceName,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      theme,
      createSpanLink,
      focusedSpanId,
      createFocusSpanLink,
      datasourceType,
      visibleSpanIds,
      traceFlameGraphs,
      setTraceFlameGraphs,
      setRedrawListView,
    } = this.props;
    const styles = getStyles(theme);
    return (
      <TimelineRow>
        <TimelineRow.Cell width={columnDivision} style={{ overflow: 'hidden' }}>
          <SpanTreeOffset
            span={span}
            showChildrenIcon={false}
            hoverIndentGuideIds={hoverIndentGuideIds}
            addHoverIndentGuideId={addHoverIndentGuideId}
            removeHoverIndentGuideId={removeHoverIndentGuideId}
            visibleSpanIds={visibleSpanIds}
          />
          <Button
            fill="text"
            onClick={this._detailToggle}
            className={classNames(styles.expandedAccent, clearButtonStyles(theme))}
            style={{ borderColor: color }}
            data-testid="detail-row-expanded-accent"
          ></Button>
        </TimelineRow.Cell>
        <TimelineRow.Cell width={1 - columnDivision}>
          <div className={styles.infoWrapper} style={{ borderTopColor: color }}>
            <SpanDetail
              detailState={detailState}
              linksGetter={this._linksGetter}
              logItemToggle={logItemToggle}
              logsToggle={logsToggle}
              processToggle={processToggle}
              referenceItemToggle={referenceItemToggle}
              referencesToggle={referencesToggle}
              warningsToggle={warningsToggle}
              stackTracesToggle={stackTracesToggle}
              span={span}
              traceToProfilesOptions={traceToProfilesOptions}
              timeZone={timeZone}
              tagsToggle={tagsToggle}
              traceStartTime={traceStartTime}
              traceDuration={traceDuration}
              traceName={traceName}
              createSpanLink={createSpanLink}
              focusedSpanId={focusedSpanId}
              createFocusSpanLink={createFocusSpanLink}
              datasourceType={datasourceType}
              traceFlameGraphs={traceFlameGraphs}
              setTraceFlameGraphs={setTraceFlameGraphs}
              setRedrawListView={setRedrawListView}
            />
          </div>
        </TimelineRow.Cell>
      </TimelineRow>
    );
  }
}

export default withTheme2(UnthemedSpanDetailRow);
