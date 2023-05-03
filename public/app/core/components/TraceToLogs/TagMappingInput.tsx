import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SegmentInput, useStyles2, InlineLabel, Icon } from '@grafana/ui';

interface Props {
  values: Array<{ key: string; value?: string }>;
  onChange: (values: Array<{ key: string; value?: string }>) => void;
  id?: string;
}

export const TagMappingInput = ({ values, onChange, id }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {values.length ? (
        values.map((value, idx) => (
          <div className={styles.pair} key={idx}>
            <SegmentInput
              id={`${id}-key-${idx}`}
              placeholder={'Tag name'}
              value={value.key}
              onChange={(e) => {
                onChange(
                  values.map((v, i) => {
                    if (i === idx) {
                      v.key = String(e);
                    }
                    return v;
                  })
                );
              }}
            />
            <InlineLabel aria-label="equals" className={styles.operator}>
              as
            </InlineLabel>
            <SegmentInput
              id={`${id}-value-${idx}`}
              placeholder={'New name (optional)'}
              value={value.value || ''}
              onChange={(e) => {
                onChange(
                  values.map((v, i) => {
                    if (i === idx) {
                      v.value = String(e);
                    }
                    return v;
                  })
                );
              }}
            />
            <button
              onClick={() => onChange([...values.slice(0, idx), ...values.slice(idx + 1)])}
              className="gf-form-label query-part"
              aria-label="Remove tag"
              type="button"
            >
              <Icon name="times" />
            </button>
            {idx === values.length - 1 ? (
              <button
                onClick={() => onChange([...values, { key: '', value: '' }])}
                className="gf-form-label query-part"
                aria-label="Add tag"
                type="button"
              >
                <Icon name="plus" />
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <button
          onClick={() => onChange([...values, { key: '', value: '' }])}
          className="gf-form-label query-part"
          aria-label="Add tag"
          type="button"
        >
          <Icon name="plus" />
        </button>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(0.5)} 0;
  `,
  pair: css`
    display: flex;
    justify-content: start;
    align-items: center;
  `,
  operator: css`
    color: ${theme.v1.palette.orange};
    width: auto;
  `,
});
