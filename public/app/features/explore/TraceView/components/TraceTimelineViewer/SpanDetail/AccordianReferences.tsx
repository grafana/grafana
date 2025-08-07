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

import { css, cx } from '@emotion/css';
import * as React from 'react';

import { Field, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Counter, Icon, useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';
import { TraceSpanReference } from '../../types/trace';
import ReferenceLink from '../../url/ReferenceLink';

import AccordianKeyValues from './AccordianKeyValues';

import { alignIcon } from '.';

const getStyles = (theme: GrafanaTheme2) => ({
  AccordianReferenceItem: css({
    borderBottom: `1px solid ${autoColor(theme, '#d8d8d8')}`,
  }),
  AccordianKeyValues: css({
    marginLeft: '10px',
  }),
  AccordianReferences: css({
    label: 'AccordianReferences',
    position: 'relative',
    marginBottom: '0.25rem',
  }),
  AccordianReferencesHeader: css({
    label: 'AccordianReferencesHeader',
    color: 'inherit',
    display: 'block',
    padding: '0.25rem 0',
    '&:hover': {
      background: autoColor(theme, '#dadada'),
    },
  }),
  AccordianReferencesContent: css({
    label: 'AccordianReferencesContent',
    background: autoColor(theme, '#f0f0f0'),
    borderTop: `1px solid ${autoColor(theme, '#d8d8d8')}`,
    padding: '0.5rem 0.5rem 0.25rem 0.5rem',
  }),
  AccordianReferencesFooter: css({
    label: 'AccordianReferencesFooter',
    color: autoColor(theme, '#999'),
  }),
  AccordianKeyValuesItem: css({
    marginBottom: theme.spacing(0.5),
  }),
  ReferencesList: css({
    background: '#fff',
    border: '1px solid #ddd',
    marginBottom: '0.7em',
    maxHeight: '450px',
    overflow: 'auto',
  }),
  list: css({
    width: '100%',
    listStyle: 'none',
    padding: 0,
    margin: 0,
    background: '#fff',
  }),
  itemContent: css({
    padding: '0.25rem 0.5rem',
    display: 'flex',
    width: '100%',
    justifyContent: 'space-between',
  }),
  item: css({
    '&:nth-child(2n)': {
      background: '#f5f5f5',
    },
  }),
  debugInfo: css({
    letterSpacing: '0.25px',
    margin: '0.5em 0 0',
    flexWrap: 'wrap',
    display: 'flex',
    justifyContent: 'flex-end',
  }),
  debugLabel: css({
    margin: '0 5px 0 5px',
    '&::before': {
      color: '#bbb',
      content: 'attr(data-label)',
    },
  }),
  serviceName: css({
    marginRight: '8px',
  }),
  title: css({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  }),
});

export type AccordianReferencesProps = {
  data: TraceSpanReference[];
  highContrast?: boolean;
  interactive?: boolean;
  isOpen: boolean;
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  onToggle?: null | (() => void);
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel<Field>;
};

type ReferenceItemProps = {
  data: TraceSpanReference[];
  interactive?: boolean;
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel<Field>;
};

// export for test
export function References(props: ReferenceItemProps) {
  const { data, createFocusSpanLink, openedItems, onItemToggle, interactive } = props;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.AccordianReferencesContent}>
      {data.map((reference, i) => (
        <div className={i < data.length - 1 ? styles.AccordianReferenceItem : undefined} key={i}>
          <div className={styles.item} key={`${reference.spanID}`}>
            <ReferenceLink reference={reference} createFocusSpanLink={createFocusSpanLink}>
              <span className={styles.itemContent}>
                {reference.span ? (
                  <span>
                    <span className={cx('span-svc-name', styles.serviceName)}>
                      {reference.span.process.serviceName}
                    </span>
                    <small className="endpoint-name">{reference.span.operationName}</small>
                  </span>
                ) : (
                  <span className={cx('span-svc-name', styles.title)}>
                    <Trans i18nKey="explore.accordian-references.view-linked-span">View Linked Span</Trans>{' '}
                    <Icon name="external-link-alt" />
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
                className={i < data.length - 1 ? styles.AccordianKeyValuesItem : null}
                data={reference.tags || []}
                highContrast
                interactive={interactive}
                isOpen={openedItems ? openedItems.has(reference) : false}
                label={t('explore.references.label-attributes', 'attributes')}
                onToggle={interactive && onItemToggle ? () => onItemToggle(reference) : null}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const AccordianReferences = ({
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

  const styles = useStyles2(getStyles);
  return (
    <div className={styles.AccordianReferences}>
      <HeaderComponent className={styles.AccordianReferencesHeader} {...headerProps}>
        {arrow}
        <strong>
          <span>
            <Trans i18nKey="explore.accordian-references.references">References</Trans>
          </span>
        </strong>{' '}
        <Counter value={data.length} />
      </HeaderComponent>
      {isOpen && (
        <References
          data={data}
          openedItems={openedItems}
          createFocusSpanLink={createFocusSpanLink}
          onItemToggle={onItemToggle}
          interactive={interactive}
        />
      )}
    </div>
  );
};

export default React.memo(AccordianReferences);
