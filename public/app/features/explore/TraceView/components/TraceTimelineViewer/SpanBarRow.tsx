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

import { css, keyframes } from '@emotion/css';
import cx from 'classnames';
import * as React from 'react';

import { GrafanaTheme2, TraceKeyValuePair } from '@grafana/data';
import { DURATION, NONE, TAG } from '@grafana/o11y-ds-frontend';
import { Icon, stylesFactory, withTheme2 } from '@grafana/ui';

import { autoColor } from '../Theme';
import { SpanBarOptions, SpanLinkFunc, TraceSpan, TNil, CriticalPathSection } from '../types';

import SpanBar from './SpanBar';
import { SpanLinksMenu } from './SpanLinks';
import SpanTreeOffset from './SpanTreeOffset';
import Ticks from './Ticks';
import TimelineRow from './TimelineRow';
import { formatDuration, ViewedBoundsFunctionType } from './utils';

const spanBarClassName = 'spanBar';
const spanBarLabelClassName = 'spanBarLabel';
const nameWrapperClassName = 'nameWrapper';
const nameWrapperMatchingFilterClassName = 'nameWrapperMatchingFilter';
const viewClassName = 'jaegerView';
const nameColumnClassName = 'nameColumn';

const getStyles = stylesFactory((theme: GrafanaTheme2, showSpanFilterMatchesOnly: boolean) => {
  const animations = {
    label: 'flash',
    flash: keyframes`
    from {
      background-color: ${autoColor(theme, '#68b9ff')};
    }
    to {
      background-color: 'default';
    }
  `,
  };
  const backgroundColor = showSpanFilterMatchesOnly ? '' : autoColor(theme, '#fffce4');

  return {
    nameWrapper: css({
      label: 'nameWrapper',
      lineHeight: '27px',
      overflow: 'hidden',
      display: 'flex',
    }),
    nameWrapperMatchingFilter: css({
      label: 'nameWrapperMatchingFilter',
      backgroundColor: backgroundColor,
    }),
    nameColumn: css({
      label: 'nameColumn',
      position: 'relative',
      whiteSpace: 'nowrap',
      zIndex: 1,
      '&:hover': {
        zIndex: 1,
      },
    }),
    endpointName: css({
      label: 'endpointName',
      color: autoColor(theme, '#484848'),
      fontSize: '0.9em',
    }),
    view: css({
      label: 'view',
      position: 'relative',
    }),
    viewExpanded: css({
      label: 'viewExpanded',
      background: autoColor(theme, '#f8f8f8'),
      outline: `1px solid ${autoColor(theme, '#ddd')}`,
    }),
    viewExpandedAndMatchingFilter: css({
      label: 'viewExpandedAndMatchingFilter',
      background: autoColor(theme, '#fff3d7'),
      outline: `1px solid ${autoColor(theme, '#ddd')}`,
    }),
    row: css({
      label: 'row',
      fontSize: '0.9em',
      [`&:hover .${spanBarClassName}`]: {
        opacity: 1,
      },
      [`&:hover .${spanBarLabelClassName}`]: {
        color: autoColor(theme, '#000'),
      },
      [`&:hover .${nameWrapperClassName}`]: {
        background: `linear-gradient(
          90deg,
          ${autoColor(theme, '#fafafa')},
          ${autoColor(theme, '#f8f8f8')} 75%,
          ${autoColor(theme, '#eee')}
        )`,
      },
      [`&:hover .${viewClassName}`]: {
        backgroundColor: autoColor(theme, '#f5f5f5'),
        outline: `1px solid ${autoColor(theme, '#ddd')}`,
      },
    }),
    rowClippingLeft: css({
      label: 'rowClippingLeft',
      [`& .${nameColumnClassName}::before`]: {
        content: '" "',
        height: '100%',
        position: 'absolute',
        width: '6px',
        backgroundImage: `linear-gradient(
          to right,
          ${autoColor(theme, 'rgba(25, 25, 25, 0.25)')},
          ${autoColor(theme, 'rgba(32, 32, 32, 0)')}
        )`,
        left: '100%',
        zIndex: -1,
      },
    }),
    rowClippingRight: css({
      label: 'rowClippingRight',
      [`& .${viewClassName}::before`]: {
        content: '" "',
        height: '100%',
        position: 'absolute',
        width: '6px',
        backgroundImage: `linear-gradient(
          to left,
          ${autoColor(theme, 'rgba(25, 25, 25, 0.25)')},
          ${autoColor(theme, 'rgba(25, 25, 25, 0.25)')}
        )`,
        right: '0%',
        zIndex: 1,
      },
    }),
    rowExpanded: css({
      label: 'rowExpanded',
      [`& .${spanBarClassName}`]: {
        opacity: 1,
      },
      [`& .${spanBarLabelClassName}`]: {
        color: autoColor(theme, '#000'),
      },
      [`& .${nameWrapperClassName}, &:hover .${nameWrapperClassName}`]: {
        background: autoColor(theme, '#f0f0f0'),
        boxShadow: `0 1px 0 ${autoColor(theme, '#ddd')}`,
      },
      [`& .${nameWrapperMatchingFilterClassName}`]: {
        background: autoColor(theme, '#fff3d7'),
      },
      [`&:hover .${viewClassName}`]: {
        background: autoColor(theme, '#eee'),
      },
    }),
    rowMatchingFilter: css({
      label: 'rowMatchingFilter',
      // background-color: ${autoColor(theme, '#fffbde')};
      [`&:hover .${nameWrapperClassName}`]: {
        background: `linear-gradient(
          90deg,
          ${autoColor(theme, '#fffbde')},
          ${autoColor(theme, '#fffbde')} 75%,
          ${autoColor(theme, '#f7f1c6')}
        )`,
      },
      [`&:hover .${viewClassName}`]: {
        backgroundColor: autoColor(theme, '#f7f1c6'),
        outline: `1px solid ${autoColor(theme, '#ddd')}`,
      },
    }),
    rowFocused: css({
      label: 'rowFocused',
      backgroundColor: autoColor(theme, '#cbe7ff'),
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        animation: `${animations.flash} 1s cubic-bezier(0.12, 0, 0.39, 0)`,
      },
      [`& .${nameWrapperClassName}, .${viewClassName}, .${nameWrapperMatchingFilterClassName}`]: {
        backgroundColor: autoColor(theme, '#cbe7ff'),
        animation: `${animations.flash} 1s cubic-bezier(0.12, 0, 0.39, 0)`,
      },
      [`& .${spanBarClassName}`]: {
        opacity: 1,
      },
      [`& .${spanBarLabelClassName}`]: {
        color: autoColor(theme, '#000'),
      },
      ['&:hover .${nameWrapperClassName}, :hover .${viewClassName}']: {
        background: autoColor(theme, '#d5ebff'),
        boxShadow: `0 1px 0 ${autoColor(theme, '#ddd')}`,
      },
    }),

    rowExpandedAndMatchingFilter: css({
      label: 'rowExpandedAndMatchingFilter',
      [`&:hover .${viewClassName}`]: {
        background: autoColor(theme, '#ffeccf'),
      },
    }),

    name: css({
      label: 'name',
      color: autoColor(theme, '#000'),
      cursor: 'pointer',
      flex: '1 1 auto',
      outline: 'none',
      overflowY: 'hidden',
      overflowX: 'auto',
      paddingLeft: '4px',
      paddingRight: '0.25em',
      position: 'relative',
      '-ms-overflow-style': 'none',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      '&:focus': {
        textDecoration: 'none',
      },
      '&:hover > span': {
        color: autoColor(theme, '#000'),
      },
      textAlign: 'left',
      background: 'transparent',
      border: 'none',
      borderBottomWidth: '1px',
      borderBottomStyle: 'solid',
    }),
    nameDetailExpanded: css({
      label: 'nameDetailExpanded',
      '&::before': {
        bottom: 0,
      },
    }),
    svcName: css({
      label: 'svcName',
      fontSize: '0.9em',
      fontWeight: 'bold',
      marginRight: '0.25rem',
    }),
    svcNameChildrenCollapsed: css({
      label: 'svcNameChildrenCollapsed',
      fontWeight: 'bold',
      fontStyle: 'italic',
    }),
    errorIcon: css({
      label: 'errorIcon',
      // eslint-disable-next-line @grafana/no-border-radius-literal
      borderRadius: '6.5px',
      color: autoColor(theme, '#fff'),
      fontSize: '0.85em',
      marginRight: '0.25rem',
      padding: '1px',
    }),
    rpcColorMarker: css({
      label: 'rpcColorMarker',
      // eslint-disable-next-line @grafana/no-border-radius-literal
      borderRadius: '6.5px',
      display: 'inline-block',
      fontSize: '0.85em',
      height: '1em',
      marginRight: '0.25rem',
      padding: '1px',
      width: '1em',
      verticalAlign: 'middle',
    }),
    labelRight: css({
      label: 'labelRight',
      left: '100%',
    }),
    labelLeft: css({
      label: 'labelLeft',
      right: '100%',
    }),
  };
});

export type SpanBarRowProps = {
  className?: string;
  theme: GrafanaTheme2;
  color: string;
  spanBarOptions: SpanBarOptions | undefined;
  columnDivision: number;
  isChildrenExpanded: boolean;
  isDetailExpanded: boolean;
  isMatchingFilter: boolean;
  isFocused: boolean;
  showSpanFilterMatchesOnly: boolean;
  onDetailToggled: (spanID: string) => void;
  onChildrenToggled: (spanID: string) => void;
  numTicks: number;
  showServiceName: boolean;
  rpc?:
    | {
        viewStart: number;
        viewEnd: number;
        color: string;
        operationName: string;
        serviceName: string;
      }
    | TNil;
  noInstrumentedServer?:
    | {
        color: string;
        serviceName: string;
      }
    | TNil;
  showErrorIcon: boolean;
  getViewedBounds: ViewedBoundsFunctionType;
  traceStartTime: number;
  span: TraceSpan;
  hoverIndentGuideIds: Set<string>;
  addHoverIndentGuideId: (spanID: string) => void;
  removeHoverIndentGuideId: (spanID: string) => void;
  clippingLeft?: boolean;
  clippingRight?: boolean;
  createSpanLink?: SpanLinkFunc;
  datasourceType: string;
  visibleSpanIds: string[];
  criticalPath: CriticalPathSection[];
};

/**
 * This was originally a stateless function, but changing to a PureComponent
 * reduced the render time of expanding a span row detail by ~50%. This is
 * even true in the case where the stateless function has the same prop types as
 * this class and arrow functions are created in the stateless function as
 * handlers to the onClick props. E.g. for now, the PureComponent is more
 * performance than the stateless function.
 */
export class UnthemedSpanBarRow extends React.PureComponent<SpanBarRowProps> {
  static displayName = 'UnthemedSpanBarRow';
  static defaultProps: Partial<SpanBarRowProps> = {
    className: '',
    rpc: null,
  };

  _detailToggle = () => {
    this.props.onDetailToggled(this.props.span.spanID);
  };

  _childrenToggle = () => {
    this.props.onChildrenToggled(this.props.span.spanID);
  };

  render() {
    const {
      className,
      color,
      spanBarOptions,
      columnDivision,
      isChildrenExpanded,
      isDetailExpanded,
      isMatchingFilter,
      showSpanFilterMatchesOnly,
      isFocused,
      numTicks,
      rpc,
      noInstrumentedServer,
      showErrorIcon,
      getViewedBounds,
      traceStartTime,
      span,
      hoverIndentGuideIds,
      addHoverIndentGuideId,
      removeHoverIndentGuideId,
      clippingLeft,
      clippingRight,
      theme,
      createSpanLink,
      datasourceType,
      showServiceName,
      visibleSpanIds,
      criticalPath,
    } = this.props;
    const {
      duration,
      hasChildren: isParent,
      operationName,
      process: { serviceName },
    } = span;
    const label = formatDuration(duration);

    const viewBounds = getViewedBounds(span.startTime, span.startTime + span.duration);
    const viewStart = viewBounds.start;
    const viewEnd = viewBounds.end;
    const styles = getStyles(theme, showSpanFilterMatchesOnly);

    const labelDetail = `${serviceName}::${operationName}`;
    let longLabel;
    let hintClassName;
    if (viewStart > 1 - viewEnd) {
      longLabel = `${labelDetail} | ${label}`;
      hintClassName = styles.labelLeft;
    } else {
      longLabel = `${label} | ${labelDetail}`;
      hintClassName = styles.labelRight;
    }

    return (
      <TimelineRow
        className={cx(
          styles.row,
          {
            [styles.rowExpanded]: isDetailExpanded,
            [styles.rowMatchingFilter]: isMatchingFilter,
            [styles.rowExpandedAndMatchingFilter]: isMatchingFilter && isDetailExpanded,
            [styles.rowFocused]: isFocused,
            [styles.rowClippingLeft]: clippingLeft,
            [styles.rowClippingRight]: clippingRight,
          },
          className
        )}
      >
        <TimelineRow.Cell className={cx(styles.nameColumn, nameColumnClassName)} width={columnDivision}>
          <div
            className={cx(styles.nameWrapper, nameWrapperClassName, {
              [styles.nameWrapperMatchingFilter]: isMatchingFilter,
              nameWrapperMatchingFilter: isMatchingFilter,
            })}
          >
            <SpanTreeOffset
              onClick={isParent ? this._childrenToggle : undefined}
              childrenVisible={isChildrenExpanded}
              span={span}
              hoverIndentGuideIds={hoverIndentGuideIds}
              addHoverIndentGuideId={addHoverIndentGuideId}
              removeHoverIndentGuideId={removeHoverIndentGuideId}
              visibleSpanIds={visibleSpanIds}
            />
            <button
              type="button"
              className={cx(styles.name, { [styles.nameDetailExpanded]: isDetailExpanded })}
              aria-checked={isDetailExpanded}
              title={labelDetail}
              onClick={this._detailToggle}
              role="switch"
              style={{ background: `${color}10`, borderBottomColor: `${color}CF` }}
              tabIndex={0}
            >
              {showErrorIcon && (
                <Icon
                  name={'exclamation-circle'}
                  style={{
                    backgroundColor: span.errorIconColor
                      ? autoColor(theme, span.errorIconColor)
                      : autoColor(theme, '#db2828'),
                  }}
                  className={styles.errorIcon}
                />
              )}
              {showServiceName && (
                <span
                  className={cx(styles.svcName, {
                    [styles.svcNameChildrenCollapsed]: isParent && !isChildrenExpanded,
                  })}
                >
                  {`${serviceName} `}
                </span>
              )}
              {rpc && (
                <span>
                  <Icon name={'arrow-right'} />{' '}
                  <i className={styles.rpcColorMarker} style={{ background: rpc.color }} />
                  {rpc.serviceName}
                </span>
              )}
              {noInstrumentedServer && (
                <span>
                  <Icon name={'arrow-right'} />{' '}
                  <i className={styles.rpcColorMarker} style={{ background: noInstrumentedServer.color }} />
                  {noInstrumentedServer.serviceName}
                </span>
              )}
              <span className={styles.endpointName}>{rpc ? rpc.operationName : operationName}</span>
              <span className={styles.endpointName}> {this.getSpanBarLabel(span, spanBarOptions, label)}</span>
            </button>
            {createSpanLink &&
              (() => {
                const links = createSpanLink(span);
                const count = links?.length || 0;
                if (links && count === 1) {
                  if (!links[0]) {
                    return null;
                  }

                  return (
                    <a
                      href={links[0].href}
                      // Needs to have target otherwise preventDefault would not work due to angularRouter.
                      target={'_blank'}
                      style={{ background: `${color}10`, borderBottom: `1px solid ${color}CF`, paddingRight: '4px' }}
                      rel="noopener noreferrer"
                      onClick={
                        links[0].onClick
                          ? (event) => {
                              if (!(event.ctrlKey || event.metaKey || event.shiftKey) && links[0].onClick) {
                                event.preventDefault();
                                links[0].onClick(event);
                              }
                            }
                          : undefined
                      }
                    >
                      {links[0].content}
                    </a>
                  );
                } else if (links && count > 1) {
                  return <SpanLinksMenu links={links} datasourceType={datasourceType} color={color} />;
                } else {
                  return null;
                }
              })()}
          </div>
        </TimelineRow.Cell>
        <TimelineRow.Cell
          className={cx(styles.view, viewClassName, {
            [styles.viewExpanded]: isDetailExpanded,
            [styles.viewExpandedAndMatchingFilter]: isMatchingFilter && isDetailExpanded,
          })}
          data-testid="span-view"
          style={{ cursor: 'pointer' }}
          width={1 - columnDivision}
          onClick={this._detailToggle}
        >
          <Ticks numTicks={numTicks} />
          <SpanBar
            criticalPath={criticalPath}
            rpc={rpc}
            viewStart={viewStart}
            viewEnd={viewEnd}
            getViewedBounds={getViewedBounds}
            color={color}
            shortLabel={label}
            longLabel={longLabel}
            traceStartTime={traceStartTime}
            span={span}
            labelClassName={`${spanBarLabelClassName} ${hintClassName}`}
            className={spanBarClassName}
          />
        </TimelineRow.Cell>
      </TimelineRow>
    );
  }

  getSpanBarLabel = (span: TraceSpan, spanBarOptions: SpanBarOptions | undefined, duration: string) => {
    const type = spanBarOptions?.type ?? '';

    if (type === NONE) {
      return '';
    } else if (type === '' || type === DURATION) {
      return `(${duration})`;
    } else if (type === TAG) {
      const tagKey = spanBarOptions?.tag?.trim() ?? '';
      if (tagKey !== '' && span.tags) {
        const tag = span.tags?.find((tag: TraceKeyValuePair) => {
          return tag.key === tagKey;
        });
        if (tag) {
          return `(${tag.value})`;
        }

        const process = span.process?.tags?.find((process: TraceKeyValuePair) => {
          return process.key === tagKey;
        });
        if (process) {
          return `(${process.value})`;
        }
      }
    }

    return '';
  };
}

export default withTheme2(UnthemedSpanBarRow);
