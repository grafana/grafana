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

import { css } from '@emotion/css';
import * as React from 'react';

import { Field, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';
import { TraceSpanReference } from '../../types/trace';
import MetricLink from '../../url/MetricLink';

// import AccordianKeyValues from './AccordianKeyValues';

import { alignIcon } from '.';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    AccordianReferenceItem: css`
      border-bottom: 1px solid ${autoColor(theme, '#d8d8d8')};
    `,
    AccordianKeyValues: css`
      margin-left: 10px;
    `,
    AccordianMetricRef: css`
      label: AccordianMetricRef;
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
    AccordianKeyValuesItem: css({
      marginBottom: theme.spacing(0.5),
    }),
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
    serviceName: css`
      margin-right: 8px;
    `,
    title: css`
      display: flex;
      align-items: center;
      gap: 4px;
    `,
  };
};

export type AccordianReferencesProps = {
  data: any[];
  highContrast?: boolean;
  interactive?: boolean;
  isOpen: boolean;
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  onToggle?: null | (() => void);
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel<Field>;
};

type ReferenceItemProps = {
  data: any[];
  names: string[];
  interactive?: boolean;
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel<Field>;
};

// export for test
export function ChildrenMetrics(props: ReferenceItemProps) {
  // const { data, createFocusSpanLink, openedItems, onItemToggle, interactive } = props;
  const { data, createFocusSpanLink, names } = props;
  const styles = useStyles2(getStyles);

  data.map((ref) => {
    console.log('ref.span', ref.span);
    console.log({ ref });
  });


  return (
    <div className={styles.AccordianReferencesContent}>
      {names.map((name, i) => (
        <>
          <span className={styles.debugLabel}>
            {name}
          </span>
          <MetricsRow key={i} data={data} name={name} createFocusSpanLink={createFocusSpanLink} />
        </>
      ))}
    </div>
  );
}

type MetricRowProps = {
  data: any[];
  name: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel<Field>;
};

const MetricsRow = (props: MetricRowProps) => {
  const { data, createFocusSpanLink, name } = props;
  const styles = useStyles2(getStyles)

  return (
    <>
      {data.map((reference, i) => (
        (reference.tags[1].value === name) ? (
          <div className={i < data.length - 1 ? styles.AccordianReferenceItem : undefined} key={i}>
            <div className={styles.item} key={`${reference.spanID}`}>
              <span className={styles.itemContent}>
                <small className={styles.debugInfo}>
                  <span className={styles.debugLabel}>
                    {reference.tags[0].key}: {reference.tags[0].value}
                  </span>
                  <span className={styles.debugLabel} />
                  <span className={styles.debugLabel}>
                    <MetricLink reference={reference} createFocusSpanLink={createFocusSpanLink} />
                  </span>
                </small>
              </span>
            </div>
          </div>
        ) : (null
        )
      ))}
    </>
  )

}

const AccordianMetricRef = ({
  data,
  interactive = true,
  isOpen,
  onToggle,
  onItemToggle,
  openedItems,
  createFocusSpanLink,
}: AccordianReferencesProps) => {
  const isEmpty = !Array.isArray(data) || !data.length;
  let arrow: React.ReactNode | null = null;
  let HeaderComponent: 'span' | 'a' = 'span';
  let headerProps: {} | null = null;
  if (interactive) {
    arrow = isOpen ? (
      <Icon name={'angle-down'} className={alignIcon} />
    ) : (
      <Icon name={'angle-right'} className={alignIcon} />
    );
    HeaderComponent = 'a';
    headerProps = {
      'aria-checked': isOpen,
      onClick: isEmpty ? null : onToggle,
      role: 'switch',
    };
  }

  let names = []

  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].tags.length; j++) {
      if (data[i].tags[j].key === "name" && names.indexOf(data[i].tags[j].value) === -1) {
        names.push(data[i].tags[j].value)
      }
    }
  }

  const styles = useStyles2(getStyles);
  return (
    <div className={styles.AccordianMetricRef}>
      <HeaderComponent className={styles.AccordianReferencesHeader} {...headerProps}>
        {arrow}
        <strong>
          <span>Children Metrics</span>
        </strong>{' '}
        ({names.length})
      </HeaderComponent>
      {isOpen && (
        <ChildrenMetrics
          data={data}
          names={names}
          openedItems={openedItems}
          createFocusSpanLink={createFocusSpanLink}
          onItemToggle={onItemToggle}
          interactive={interactive}
        />
      )}
    </div>
  );
};

export default React.memo(AccordianMetricRef);
