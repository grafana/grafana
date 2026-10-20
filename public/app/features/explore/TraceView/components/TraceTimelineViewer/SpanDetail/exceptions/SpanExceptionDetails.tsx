import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Alert, Icon, useStyles2 } from '@grafana/ui';

import { type SpanException } from './span-exception';

type SpanExceptionDetailsProps = {
  exception: SpanException;
};

export default function SpanExceptionDetails({ exception }: SpanExceptionDetailsProps) {
  const styles = useStyles2(getStyles);
  const [isStacktraceOpen, setIsStacktraceOpen] = useState(false);

  const { type, message, stacktrace } = exception;

  if (!type && !message && !stacktrace) {
    return null;
  }

  return (
    <Alert
      className={styles.alert}
      severity="error"
      title=""
      aria-label={t('explore.span-detail.exception-title', 'Exception')}
      bottomSpacing={1}
      topSpacing={0}
      data-testid={selectors.components.TraceViewer.spanException.container}
    >
      <div className={styles.details}>
        {type && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t('explore.span-detail.exception-type', 'Type:')}</span> {type}
          </div>
        )}
        {message && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t('explore.span-detail.exception-message', 'Message:')}</span>{' '}
            {message}
          </div>
        )}
        {stacktrace && (
          <div>
            <button
              type="button"
              className={styles.stacktraceToggle}
              aria-expanded={isStacktraceOpen}
              onClick={() => setIsStacktraceOpen((open) => !open)}
              data-testid={selectors.components.TraceViewer.spanException.stacktraceButton}
            >
              <Icon name={isStacktraceOpen ? 'angle-down' : 'angle-right'} />
              {t('explore.span-detail.exception-stacktrace', 'Stacktrace')}
            </button>
            {isStacktraceOpen && <pre className={styles.stacktraceBody}>{stacktrace}</pre>}
          </div>
        )}
      </div>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  alert: css({
    // Alert always renders a title node; hide it when we leave the title empty.
    '& span:empty': {
      display: 'none',
    },
    // Alert top-aligns its severity icon; center it against the exception details instead.
    '& > div > div:first-of-type': {
      alignItems: 'center',
      paddingTop: 0,
      paddingBottom: 0,
    },
  }),
  details: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
  }),
  field: css({
    wordBreak: 'break-word',
  }),
  fieldLabel: css({
    color: theme.colors.text.secondary,
  }),
  stacktraceToggle: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: 0,
    border: 'none',
    background: 'none',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    font: 'inherit',
  }),
  stacktraceBody: css({
    margin: `${theme.spacing(0.5)} 0 0`,
    padding: 0,
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});
