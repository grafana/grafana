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
import { css } from 'emotion';
import cx from 'classnames';

import IoIosArrowDown from 'react-icons/lib/io/ios-arrow-down';
import IoIosArrowRight from 'react-icons/lib/io/ios-arrow-right';
import { TraceSpanReference } from '@grafana/data';
import ReferenceLink from '../../url/ReferenceLink';

import { createStyle } from '../../Theme';
import { uAlignIcon } from '../../uberUtilityStyles';

const getStyles = createStyle(() => {
  return {
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
  focusSpan: (uiFind: string) => void;
};

type ReferenceItemProps = {
  data: TraceSpanReference[];
  focusSpan: (uiFind: string) => void;
};

// export for test
export function References(props: ReferenceItemProps) {
  const { data, focusSpan } = props;
  const styles = getStyles();

  return (
    <div className={cx(styles.ReferencesList)}>
      <ul className={styles.list}>
        {data.map(reference => {
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
    </div>
  );
}

export default class AccordianReferences extends React.PureComponent<AccordianReferencesProps> {
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
        {isOpen && <References data={data} focusSpan={focusSpan} />}
      </div>
    );
  }
}
