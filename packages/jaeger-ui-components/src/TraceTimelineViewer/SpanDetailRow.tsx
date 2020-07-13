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

import React from 'react';
import { css } from 'emotion';

import SpanDetail from './SpanDetail';
import DetailState from './SpanDetail/DetailState';
import SpanTreeOffset from './SpanTreeOffset';
import TimelineRow from './TimelineRow';
import { autoColor, createStyle, Theme, withTheme } from '../Theme';

import { TraceLog, TraceSpan, TraceKeyValuePair, TraceLink } from '@grafana/data';

const getStyles = createStyle((theme: Theme) => {
  return {
    expandedAccent: css`
      cursor: pointer;
      height: 100%;
      overflow: hidden;
      position: absolute;
      width: 100%;
      &::before {
        border-left: 4px solid;
        pointer-events: none;
        width: 1000px;
      }
      &::after {
        border-right: 1000px solid;
        border-color: inherit;
        cursor: pointer;
        opacity: 0.2;
      }

      /* border-color inherit must come AFTER other border declarations for accent */
      &::before,
      &::after {
        border-color: inherit;
        content: ' ';
        position: absolute;
        height: 100%;
      }

      &:hover::after {
        opacity: 0.35;
      }
    `,
    infoWrapper: css`
      background: ${autoColor(theme, '#f5f5f5')};
      border: 1px solid ${autoColor(theme, '#d3d3d3')};
      border-top: 3px solid;
      padding: 0.75rem;
    `,
  };
});

type SpanDetailRowProps = {
  color: string;
  columnDivision: number;
  detailState: DetailState;
  onDetailToggled: (spanID: string) => void;
  linksGetter: (span: TraceSpan, links: TraceKeyValuePair[], index: number) => TraceLink[];
  logItemToggle: (spanID: string, log: TraceLog) => void;
  logsToggle: (spanID: string) => void;
  processToggle: (spanID: string) => void;
  referencesToggle: (spanID: string) => void;
  warningsToggle: (spanID: string) => void;
  span: TraceSpan;
  tagsToggle: (spanID: string) => void;
  traceStartTime: number;
  focusSpan: (uiFind: string) => void;
  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  theme: Theme;
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
      referencesToggle,
      warningsToggle,
      span,
      tagsToggle,
      traceStartTime,
      focusSpan,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      theme,
    } = this.props;
    const styles = getStyles(theme);
    return (
      <TimelineRow>
        <TimelineRow.Cell width={columnDivision}>
          <SpanTreeOffset
            span={span}
            showChildrenIcon={false}
            hoverIndentGuideIds={hoverIndentGuideIds}
            addHoverIndentGuideId={addHoverIndentGuideId}
            removeHoverIndentGuideId={removeHoverIndentGuideId}
          />
          <span>
            <span
              className={styles.expandedAccent}
              aria-checked="true"
              onClick={this._detailToggle}
              role="switch"
              style={{ borderColor: color }}
              data-test-id="detail-row-expanded-accent"
            />
          </span>
        </TimelineRow.Cell>
        <TimelineRow.Cell width={1 - columnDivision}>
          <div className={styles.infoWrapper} style={{ borderTopColor: color }}>
            <SpanDetail
              detailState={detailState}
              linksGetter={this._linksGetter}
              logItemToggle={logItemToggle}
              logsToggle={logsToggle}
              processToggle={processToggle}
              referencesToggle={referencesToggle}
              warningsToggle={warningsToggle}
              span={span}
              tagsToggle={tagsToggle}
              traceStartTime={traceStartTime}
              focusSpan={focusSpan}
            />
          </div>
        </TimelineRow.Cell>
      </TimelineRow>
    );
  }
}

export default withTheme(UnthemedSpanDetailRow);
