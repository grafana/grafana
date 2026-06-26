import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { InlineLabel, SegmentInput, ToolbarButton, useStyles2 } from '@grafana/ui';

import { TraceToLogsTag } from './TraceToLogsSettings';

interface Props {
  values: TraceToLogsTag[];
  onChange: (values: TraceToLogsTag[]) => void;
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
                      return { ...v, key: String(e) };
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
                      return { ...v, value: String(e) };
                    }
                    return v;
                  })
                );
              }}
            />
            <ToolbarButton
              onClick={() => onChange([...values.slice(0, idx), ...values.slice(idx + 1)])}
              className={cx(styles.removeTag, 'query-part')}
              aria-label="Remove tag"
              type="button"
              icon="times"
            />

            {idx === values.length - 1 ? (
              <ToolbarButton
                onClick={() => onChange([...values, { key: '', value: '' }])}
                className="query-part"
                aria-label="Add tag"
                type="button"
                icon="plus"
              />
            ) : null}
          </div>
        ))
      ) : (
        <ToolbarButton
          icon="plus"
          onClick={() => onChange([...values, { key: '', value: '' }])}
          className="query-part"
          aria-label="Add tag"
          type="button"
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: `${theme.spacing(0.5)} 0`,
  }),
  pair: css({
    display: 'flex',
    justifyContent: 'start',
    alignItems: 'center',
  }),
  operator: css({
    color: theme.v1.palette.orange,
    width: 'auto',
  }),
  removeTag: css({
    marginRight: theme.spacing(0.5),
  }),
});
