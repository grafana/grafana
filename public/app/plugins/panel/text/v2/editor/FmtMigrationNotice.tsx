import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type DataFrame, type GrafanaTheme2, type InterpolateFunction } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, Modal, Stack, Text, useStyles2 } from '@grafana/ui';

import { type RenderMode, type TextMode } from '../../panelcfg.gen';
import { findFmtReads, type FmtMigration, type FmtReadReason, migrateFmt } from '../fmtMigration';
import { getFieldNames } from '../handlebars';
import { catchTemplateError, interpolateTemplate, interpretsHandlebars } from '../renderContent';

const FMT = 'fmt';
const DISPLAY_EXAMPLE = '{{display "cpu"}}';
const BLOCK_EXAMPLE = '{{#display "cpu"}}{{prefix}}{{text}}{{suffix}}{{/display}}';

interface Props {
  content: string;
  mode: TextMode;
  renderMode?: RenderMode;
  format?: string;
  frames: DataFrame[];
  replaceVariables: InterpolateFunction;
  getDraft: () => string;
  onConvert: (content: string) => void;
}

type RenderCheck = 'same' | 'changed' | 'unsteady';

interface Review {
  original: string;
  migration: FmtMigration;
  check: RenderCheck;
}

export function FmtMigrationNotice({
  content,
  mode,
  renderMode,
  format,
  frames,
  replaceVariables,
  getDraft,
  onConvert,
}: Props) {
  const styles = useStyles2(getStyles);
  const [dismissed, setDismissed] = useState(false);
  const [review, setReview] = useState<Review>();
  const hasFields = frames.some((frame) => frame.fields.length > 0);
  const readsFmt = interpretsHandlebars(mode) && content.includes(FMT);
  const hasFmtField = useMemo(
    () => readsFmt && frames.some((frame) => getFieldNames(frame, [frame]).includes(FMT)),
    [readsFmt, frames]
  );
  const reads = useMemo(
    () => findFmtReads(content, { mode, renderMode, hasFmtField }),
    [content, mode, renderMode, hasFmtField]
  );

  const total = reads.convertible + reads.unconverted.length;

  if (dismissed || total === 0) {
    return null;
  }

  const render = (template: string, series: DataFrame[]) => {
    const {
      content: rendered,
      error,
      truncated,
    } = catchTemplateError(() =>
      interpolateTemplate({ content: template, mode, series, renderMode, format }, replaceVariables)
    );
    return `${error ?? ''}|${truncated ?? false}|${rendered}`;
  };

  const checkRenders = (original: string, converted: string): RenderCheck => {
    const variants = frames.length > 1 ? frames.map((frame) => [frame]) : [frames];
    let check: RenderCheck = 'same';

    for (const series of variants) {
      const before = render(original, series);
      const after = render(converted, series);

      if (after === before) {
        continue;
      }

      const again = render(original, series);

      if (after === again) {
        continue;
      }
      if (before === again) {
        return 'changed';
      }
      check = 'unsteady';
    }

    return check;
  };

  const openReview = () => {
    const original = getDraft();
    const migration = migrateFmt(original, { mode, renderMode, hasFmtField });

    setReview({
      original,
      migration,
      check: migration.changes.length > 0 ? checkRenders(original, migration.content) : 'same',
    });
  };

  const apply = () => {
    if (review) {
      onConvert(review.migration.content);
    }
    setReview(undefined);
  };

  return (
    <>
      <Alert
        severity="info"
        title={t('textng.fmt-migration.title', 'fmt is deprecated')}
        className={styles.notice}
        bottomSpacing={0}
        onRemove={() => setDismissed(true)}
        action={
          hasFields ? (
            <Button size="sm" variant="secondary" onClick={openReview}>
              {reads.convertible > 0
                ? t('textng.fmt-migration.review', 'Convert to display')
                : t('textng.fmt-migration.show-reads', 'Show where it is used')}
            </Button>
          ) : undefined
        }
      >
        {hasFields
          ? t('textng.fmt-migration.summary', '', {
              count: total,
              converted: reads.convertible,
              defaultValue_one: '{{converted}} of {{count}} expression can be converted to the display helper.',
              defaultValue_other: '{{converted}} of {{count}} expressions can be converted to the display helper.',
            })
          : t(
              'textng.fmt-migration.needs-data',
              'Run the query so the fields can be checked, then convert it to the display helper.'
            )}
      </Alert>
      {review && (
        <Modal
          title={t('textng.fmt-migration.review-title', 'Convert fmt to display')}
          isOpen
          onDismiss={() => setReview(undefined)}
          className={styles.modal}
        >
          <Stack direction="column" gap={2}>
            <Text color="secondary">
              {t(
                'textng.fmt-migration.guidance',
                'The display helper reads the formatted value, as in {{value}}, and a block reads several of its properties, as in {{block}}.',
                { value: DISPLAY_EXAMPLE, block: BLOCK_EXAMPLE, interpolation: { escapeValue: false } }
              )}
            </Text>
            {review.migration.changes.length > 0 && (
              <Stack direction="column" gap={1}>
                {review.check === 'same' ? (
                  <Text weight="medium">
                    {t('textng.fmt-migration.converts', '', {
                      count: review.migration.changes.length,
                      defaultValue_one:
                        'Converts {{count}} expression. The panel renders the same for the current query results.',
                      defaultValue_other:
                        'Converts {{count}} expressions. The panel renders the same for the current query results.',
                    })}
                  </Text>
                ) : (
                  <Alert
                    severity="error"
                    bottomSpacing={0}
                    title={
                      review.check === 'changed'
                        ? t(
                            'textng.fmt-migration.renders-differently',
                            'The converted template renders differently for the current query results, so it is not applied'
                          )
                        : t(
                            'textng.fmt-migration.renders-unsteadily',
                            'The template renders differently every time, for example with the current time, so the conversion cannot be checked and is not applied'
                          )
                    }
                  />
                )}
                <ul className={styles.list} aria-label={t('textng.fmt-migration.changes', 'Changes')}>
                  {review.migration.changes.map((change) => (
                    <li key={change.from} className={styles.item}>
                      <Text color="secondary">{getLineLabel(change.line)}</Text>
                      <code>{review.original.slice(change.from, change.to)}</code>
                      <span aria-hidden>→</span>
                      <code>{change.text}</code>
                    </li>
                  ))}
                </ul>
              </Stack>
            )}
            {review.migration.unconverted.length > 0 && (
              <Stack direction="column" gap={1}>
                <Text weight="medium">
                  {t('textng.fmt-migration.unconverted', '', {
                    count: review.migration.unconverted.length,
                    defaultValue_one: '{{count}} expression stays as it is',
                    defaultValue_other: '{{count}} expressions stay as they are',
                  })}
                </Text>
                <ul className={styles.list} aria-label={t('textng.fmt-migration.unchanged', 'Unchanged expressions')}>
                  {review.migration.unconverted.map((read) => (
                    <li key={read.from} className={styles.item}>
                      <Text color="secondary">{getLineLabel(read.line)}</Text>
                      <code>{review.original.slice(read.from, read.to)}</code>
                      <Text color="secondary">{getGuidance(read.reason)}</Text>
                    </li>
                  ))}
                </ul>
              </Stack>
            )}
          </Stack>
          <Modal.ButtonRow>
            <Button variant="secondary" fill="outline" onClick={() => setReview(undefined)}>
              {t('textng.fmt-migration.cancel', 'Cancel')}
            </Button>
            {review.migration.changes.length > 0 && (
              <Button onClick={apply} disabled={review.check !== 'same'}>
                {t('textng.fmt-migration.convert', 'Convert')}
              </Button>
            )}
          </Modal.ButtonRow>
        </Modal>
      )}
    </>
  );
}

function getLineLabel(line: number): string {
  return t('textng.fmt-migration.line', 'Line {{line}}', { line });
}

function getGuidance(reason: FmtReadReason): string {
  switch (reason) {
    case 'namespace':
      return t(
        'textng.fmt-migration.reason-namespace',
        'Reads fmt as a whole. Read each field with display instead, as in {{example}}.',
        { example: DISPLAY_EXAMPLE, interpolation: { escapeValue: false } }
      );
    case 'helper':
      return t(
        'textng.fmt-migration.reason-helper',
        'A block parameter named display hides the helper here. Rename the block parameter, then use display.'
      );
    case 'expression':
      return t(
        'textng.fmt-migration.reason-expression',
        'Reads past the formatted value or calls it. A display property may do the same, as in {{example}}.',
        { example: '{{display "cpu" "text"}}', interpolation: { escapeValue: false } }
      );
    case 'row':
      return t(
        'textng.fmt-migration.reason-row',
        'It may not read a row of the query results here, as inside an inline partial or a block on a field value. Pass the row with row=, as in {{example}}.',
        { example: '{{display "cpu" row=..}}', interpolation: { escapeValue: false } }
      );
    case 'shadowed':
      return t(
        'textng.fmt-migration.reason-shadowed',
        'A field is displayed as fmt, so this reads that field. display reads formatted values whatever the fields are called.'
      );
    case 'name':
      return t(
        'textng.fmt-migration.reason-name',
        'The field name cannot be passed to display as it is. Rename the field with a transformation, then use display.'
      );
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  notice: css({
    flexGrow: 0,
  }),
  modal: css({
    width: theme.breakpoints.values.md,
    maxWidth: '90vw',
  }),
  list: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: 0,
    padding: 0,
  }),
  item: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(0.5),
    code: {
      wordBreak: 'break-all',
    },
  }),
});
