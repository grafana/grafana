// Copyright (c) 2019 The Jaeger Authors.
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

import * as React from 'react';
import { css } from '@emotion/css';
import cx from 'classnames';

import AccordianKeyValues from './AccordianKeyValues';
import IoIosArrowDown from 'react-icons/lib/io/ios-arrow-down';
import IoIosArrowRight from 'react-icons/lib/io/ios-arrow-right';
import { TraceSpanReference } from '../../types/trace';
import ReferenceLink from '../../url/ReferenceLink';

import { autoColor, createStyle, Theme, useTheme } from '../../Theme';
import { uAlignIcon, ubMb1 } from '../../uberUtilityStyles';

const getStyles = createStyle((theme: Theme) => {
  return {
    AccordianLogs: css`
      label: AccordianLogs;
      border: 1px solid ${autoColor(theme, '#d8d8d8')};
      position: relative;
      margin-bottom: 0.25rem;
    `,
    AccordianLogsHeader: css`
      label: AccordianLogsHeader;
      background: ${autoColor(theme, '#e4e4e4')};
      color: inherit;
      display: block;
      padding: 0.25rem 0.5rem;
      &:hover {
        background: ${autoColor(theme, '#dadada')};
      }
    `,
    AccordianLogsContent: css`
      label: AccordianLogsContent;
      background: ${autoColor(theme, '#f0f0f0')};
      border-top: 1px solid ${autoColor(theme, '#d8d8d8')};
      padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    `,
    AccordianLogsFooter: css`
      label: AccordianLogsFooter;
      color: ${autoColor(theme, '#999')};
    `,
    ReferencesList: css`
      background: #fff;
      border: 1px solid #ddd;
      margin-bottom: 0.7em;
      max-height: 450px;
      overflow: auto;
    `,
    list: css`
      width: 100%;
      list-style: none;
      padding: 0;
      margin: 0;
      background: #fff;
    `,
    itemContent: css`
      padding: 0.25rem 0.5rem;
      display: flex;
      width: 100%;
      justify-content: space-between;
    `,
    item: css`
      &:nth-child(2n) {
        background: #f5f5f5;
      }
    `,
    debugInfo: css`
      letter-spacing: 0.25px;
      margin: 0.5em 0 0;
    `,
    debugLabel: css`
      margin: 0 5px 0 5px;
      &::before {
        color: #bbb;
        content: attr(data-label);
      }
    `,
  };
});

type AccordianReferencesProps = {
  data: TraceSpanReference[];
  highContrast?: boolean;
  interactive?: boolean;
  isOpen: boolean;
  onToggle?: null | (() => void);
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  focusSpan: (uiFind: string) => void;
};

type ReferenceItemProps = {
  data: TraceSpanReference[];
  interactive?: boolean;
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  focusSpan: (uiFind: string) => void;
};

// export for test
export function References(props: ReferenceItemProps) {
  const { data, focusSpan, openedItems, onItemToggle, interactive } = props;
  const styles = getStyles(useTheme());

  return (
    <div className={styles.AccordianLogsContent}>
      {data.map((reference, i) => (
        <div key={reference.spanID}>
          <div className={styles.item} key={`${reference.spanID}`}>
            <ReferenceLink reference={reference} focusSpan={focusSpan}>
              <span className={styles.itemContent}>
                {reference.span ? (
                  <span>
                    <span className="span-svc-name">{reference.span.process.serviceName}</span>
                    <small className="endpoint-name">{reference.span.operationName}</small>
                  </span>
                ) : (
                  <span className="span-svc-name">&lt; span in another trace &gt;</span>
                )}
                <small className={styles.debugInfo}>
                  <span className={styles.debugLabel} data-label="Reference Type:">
                    {reference.refType}
                  </span>
                  <span className={styles.debugLabel} data-label="SpanID:">
                    {reference.spanID}
                  </span>
                </small>
              </span>
            </ReferenceLink>
          </div>
          <AccordianKeyValues
            className={i < data.length - 1 ? ubMb1 : null}
            data={reference.tags || []}
            highContrast
            interactive={interactive}
            isOpen={openedItems ? openedItems.has(reference) : false}
            label={`${reference.traceID}:${reference.spanID}`}
            // label="Hello world"
            // linksGetter={linksGetter}
            linksGetter={null}
            onToggle={interactive && onItemToggle ? () => onItemToggle(reference) : null}
          />
        </div>
      ))}
      {/* <div className={cx(styles.ReferencesList)}>
        <ul className={styles.list}>
          {data.map((reference, i) => {
            return (
              <li className={styles.item} key={`${reference.spanID}`}>
                <ReferenceLink reference={reference} focusSpan={focusSpan}>
                  <span className={styles.itemContent}>
                    {reference.span ? (
                      <span>
                        <span className="span-svc-name">{reference.span.process.serviceName}</span>
                        <small className="endpoint-name">{reference.span.operationName}</small>
                      </span>
                    ) : (
                      <span className="span-svc-name">&lt; span in another trace &gt;</span>
                    )}
                    <small className={styles.debugInfo}>
                      <span className={styles.debugLabel} data-label="Reference Type:">
                        {reference.refType}
                      </span>
                      <span className={styles.debugLabel} data-label="SpanID:">
                        {reference.spanID}
                      </span>
                    </small>
                  </span>
                </ReferenceLink>
              </li>
            );
          })}
        </ul>
      </div> */}
    </div>
  );
}

const AccordianReferences: React.FC<AccordianReferencesProps> = ({
  data,
  interactive = true,
  isOpen,
  onToggle,
  focusSpan,
}) => {
  const isEmpty = !Array.isArray(data) || !data.length;
  let arrow: React.ReactNode | null = null;
  let HeaderComponent: 'span' | 'a' = 'span';
  let headerProps: {} | null = null;
  if (interactive) {
    arrow = isOpen ? <IoIosArrowDown className={uAlignIcon} /> : <IoIosArrowRight className={uAlignIcon} />;
    HeaderComponent = 'a';
    headerProps = {
      'aria-checked': isOpen,
      onClick: isEmpty ? null : onToggle,
      role: 'switch',
    };
  }

  const styles = getStyles(useTheme());

  return (
    <div className={styles.AccordianLogs}>
      <HeaderComponent className={styles.AccordianLogsHeader} {...headerProps}>
        {arrow}
        <strong>
          <span>References</span>
        </strong>{' '}
        ({data.length})
      </HeaderComponent>
      {isOpen && <References data={data} focusSpan={focusSpan} />}
    </div>
  );
};

export default React.memo(AccordianReferences);

export class AccordianReferencesx extends React.PureComponent<AccordianReferencesProps> {
  static defaultProps: Partial<AccordianReferencesProps> = {
    highContrast: false,
    interactive: true,
    onToggle: null,
  };

  render() {
    const { data, interactive, isOpen, onToggle, focusSpan } = this.props;
    const isEmpty = !Array.isArray(data) || !data.length;
    const iconCls = uAlignIcon;
    let arrow: React.ReactNode | null = null;
    let headerProps: {} | null = null;
    if (interactive) {
      arrow = isOpen ? <IoIosArrowDown className={iconCls} /> : <IoIosArrowRight className={iconCls} />;
      headerProps = {
        'aria-checked': isOpen,
        onClick: isEmpty ? null : onToggle,
        role: 'switch',
      };
    }
    return (
      <div>
        <div {...headerProps}>
          {arrow}
          <strong>
            <span>References</span>
          </strong>{' '}
          ({data.length})
        </div>
        {isOpen && <References data={[...data, ...data]} focusSpan={focusSpan} />}
      </div>
    );
  }
}
