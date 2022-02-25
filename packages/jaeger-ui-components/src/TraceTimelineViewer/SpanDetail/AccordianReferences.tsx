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
import { Icon, useStyles2 } from '@grafana/ui';

import AccordianKeyValues from './AccordianKeyValues';
import IoIosArrowDown from 'react-icons/lib/io/ios-arrow-down';
import IoIosArrowRight from 'react-icons/lib/io/ios-arrow-right';
import { TraceSpanReference } from '../../types/trace';
import ReferenceLink from '../../url/ReferenceLink';
import { uAlignIcon, ubMb1 } from '../../uberUtilityStyles';
import { GrafanaTheme2 } from '@grafana/data';
import { autoColor } from '../../Theme';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    AccordianReferenceItem: css`
      border-bottom: 1px solid ${autoColor(theme, '#d8d8d8')};
    `,
    AccordianKeyValues: css`
      margin-left: 10px;
    `,
    AccordianReferences: css`
      label: AccordianReferences;
      border: 1px solid ${autoColor(theme, '#d8d8d8')};
      position: relative;
      margin-bottom: 0.25rem;
    `,
    AccordianReferencesHeader: css`
      label: AccordianReferencesHeader;
      background: ${autoColor(theme, '#e4e4e4')};
      color: inherit;
      display: block;
      padding: 0.25rem 0.5rem;
      &:hover {
        background: ${autoColor(theme, '#dadada')};
      }
    `,
    AccordianReferencesContent: css`
      label: AccordianReferencesContent;
      background: ${autoColor(theme, '#f0f0f0')};
      border-top: 1px solid ${autoColor(theme, '#d8d8d8')};
      padding: 0.5rem 0.5rem 0.25rem 0.5rem;
    `,
    AccordianReferencesFooter: css`
      label: AccordianReferencesFooter;
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
      flex-wrap: wrap;
      display: flex;
      justify-content: flex-end;
    `,
    debugLabel: css`
      margin: 0 5px 0 5px;
      &::before {
        color: #bbb;
        content: attr(data-label);
      }
    `,
  };
};

type AccordianReferencesProps = {
  data: TraceSpanReference[];
  highContrast?: boolean;
  interactive?: boolean;
  isOpen: boolean;
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  onToggle?: null | (() => void);
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
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.AccordianReferencesContent}>
      {data.map((reference, i) => (
        <div className={i < data.length - 1 ? styles.AccordianReferenceItem : undefined} key={reference.spanID}>
          <div className={styles.item} key={`${reference.spanID}`}>
            <ReferenceLink reference={reference} focusSpan={focusSpan}>
              <span className={styles.itemContent}>
                {reference.span ? (
                  <span>
                    <span className="span-svc-name">{reference.span.process.serviceName}</span>
                    <small className="endpoint-name">{reference.span.operationName}</small>
                  </span>
                ) : (
                  <span className="span-svc-name">
                    View Linked Span <Icon name="external-link-alt" />
                  </span>
                )}
                <small className={styles.debugInfo}>
                  <span className={styles.debugLabel} data-label="TraceID:">
                    {reference.traceID}
                  </span>
                  <span className={styles.debugLabel} data-label="SpanID:">
                    {reference.spanID}
                  </span>
                </small>
              </span>
            </ReferenceLink>
          </div>
          {!!reference.tags?.length && (
            <div className={styles.AccordianKeyValues}>
              <AccordianKeyValues
                className={i < data.length - 1 ? ubMb1 : null}
                data={reference.tags || []}
                highContrast
                interactive={interactive}
                isOpen={openedItems ? openedItems.has(reference) : false}
                label={'attributes'}
                linksGetter={null}
                onToggle={interactive && onItemToggle ? () => onItemToggle(reference) : null}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const AccordianReferences: React.FC<AccordianReferencesProps> = ({
  data,
  interactive = true,
  isOpen,
  onToggle,
  onItemToggle,
  openedItems,
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

  const styles = useStyles2(getStyles);
  return (
    <div className={styles.AccordianReferences}>
      <HeaderComponent className={styles.AccordianReferencesHeader} {...headerProps}>
        {arrow}
        <strong>
          <span>References</span>
        </strong>{' '}
        ({data.length})
      </HeaderComponent>
      {isOpen && (
        <References
          data={data}
          openedItems={openedItems}
          focusSpan={focusSpan}
          onItemToggle={onItemToggle}
          interactive={interactive}
        />
      )}
    </div>
  );
};

export default React.memo(AccordianReferences);
