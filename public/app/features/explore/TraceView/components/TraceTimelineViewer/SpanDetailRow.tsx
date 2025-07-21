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
import { PureComponent } from 'react';

import { CoreApp, GrafanaTheme2, LinkModel, TimeRange, TraceLog } from '@grafana/data';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { TimeZone } from '@grafana/schema';
import { stylesFactory, withTheme2 } from '@grafana/ui';

import { SpanLinkFunc } from '../types/links';
import { TraceSpan, TraceSpanReference } from '../types/trace';

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
      padding: '0.75rem',
    }),
    cell: css({
      label: 'cell',
      display: 'flex !important',
      width: '100% !important',
    }),
    indentSpacer: css({
      label: 'indentSpacer',
      flex: 'none',
    }),
    detailWrapper: css({
      label: 'detailWrapper',
      flex: '1',
      minWidth: 0,
    }),
  };
});

export type SpanDetailRowProps = {
  color: string;
  columnDivision: number;
  detailState: DetailState;
  onDetailToggled: (spanID: string) => void;
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
  datasourceUid: string;
  visibleSpanIds: string[];
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  setRedrawListView: (redraw: {}) => void;
  timeRange: TimeRange;
  app: CoreApp;
};

export class UnthemedSpanDetailRow extends PureComponent<SpanDetailRowProps> {
  _detailToggle = () => {
    this.props.onDetailToggled(this.props.span.spanID);
  };

  render() {
    const {
      color,
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
      theme,
      createSpanLink,
      focusedSpanId,
      createFocusSpanLink,
      datasourceType,
      datasourceUid,
      traceFlameGraphs,
      setTraceFlameGraphs,
      setRedrawListView,
      timeRange,
      app,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      visibleSpanIds,
    } = this.props;
    const styles = getStyles(theme);
    return (
      <TimelineRow>
        <TimelineRow.Cell width={1} className={styles.cell}>
          <div className={styles.indentSpacer}>
            <SpanTreeOffset
              span={span}
              showChildrenIcon={false}
              hoverIndentGuideIds={hoverIndentGuideIds}
              addHoverIndentGuideId={addHoverIndentGuideId}
              removeHoverIndentGuideId={removeHoverIndentGuideId}
              visibleSpanIds={visibleSpanIds}
            />
          </div>
          <div className={styles.detailWrapper}>
            <div className={styles.infoWrapper} style={{ borderTopColor: color }}>
              <SpanDetail
                color={color}
                detailState={detailState}
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
                datasourceUid={datasourceUid}
                traceFlameGraphs={traceFlameGraphs}
                setTraceFlameGraphs={setTraceFlameGraphs}
                setRedrawListView={setRedrawListView}
                timeRange={timeRange}
                app={app}
              />
            </div>
          </div>
        </TimelineRow.Cell>
      </TimelineRow>
    );
  }
}

export default withTheme2(UnthemedSpanDetailRow);
