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

import { Field, LinkModel } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import AccordianKeyValues from '../TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import { TraceSpanReference } from '../types/trace';
import { ubMb1 } from '../uberUtilityStyles';
import ReferenceLink from '../url/ReferenceLink';

const getStyles = () => {
  return {
    AccordianKeyValues: css({
      marginLeft: '10px',
    }),
    AccordianReferences: css({
      label: 'AccordianReferences',
      position: 'relative',
      marginBottom: '0.25rem',
    }),
    itemContent: css({
      padding: '0.25rem 0.5rem',
      display: 'flex',
      width: '100%',
      justifyContent: 'space-between',
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
    }),
    serviceName: css({
      marginRight: '8px',
    }),
    title: css({
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    }),
  };
};

export type AccordianReferencesProps = {
  data: TraceSpanReference[];
  highContrast?: boolean;
  openedItems?: Set<TraceSpanReference>;
  onItemToggle?: (reference: TraceSpanReference) => void;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel<Field>;
};

type ReferenceItemProps = {
  data: TraceSpanReference[];
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel<Field>;
};

// export for test
export function References(props: ReferenceItemProps) {
  const { data, createFocusSpanLink } = props;
  const styles = useStyles2(getStyles);

  return (
    <>
      {data.map((reference, i) => (
        <div key={i}>
          <div key={`${reference.spanID}`}>
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
                    View Linked Span <Icon name="external-link-alt" />
                  </span>
                )}
                <small className={styles.debugInfo}>
                  <span className={styles.debugLabel}>TraceID:{reference.traceID}</span>
                  <span className={styles.debugLabel}>SpanID:{reference.spanID}</span>
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
                isOpen={true}
                label={'attributes'}
                linksGetter={null}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

const AccordianReferences = ({ data, createFocusSpanLink }: AccordianReferencesProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.AccordianReferences}>
      <References data={data} createFocusSpanLink={createFocusSpanLink} />
    </div>
  );
};

export default React.memo(AccordianReferences);
