import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { createAssistantContextItem, OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ClipboardButton, Icon, useStyles2 } from '@grafana/ui';

import { type FieldDef } from '../logParser';
import { classifyErrorAttributes } from '../otel/details';
import { OTEL_LANGUAGE_UNKNOWN } from '../otel/formats';

import { type LabelWithLinks } from './LogLineDetailsFields';
import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';
import { getNormalizedFieldName } from './processing';

interface LogLineDetailsErrorProps {
  className?: string;
  fields: FieldDef[];
  labels: LabelWithLinks[];
  otelLanguage?: string;
}

interface ErrorDisplayItem {
  key: string;
  value: string;
}

export const LogLineDetailsError = ({ className, fields, labels, otelLanguage }: LogLineDetailsErrorProps) => {
  const { fontSize, noInteractions } = useLogListContext();
  const { isAvailable } = useAssistant();
  const styles = useStyles2(getStyles, fontSize);

  const classifiedFields = useMemo(() => classifyErrorAttributes(fields, (field) => field.keys[0] ?? ''), [fields]);
  const classifiedLabels = useMemo(() => classifyErrorAttributes(labels, (label) => label.key), [labels]);

  const messages = useMemo(
    () => [...toLabelItems(classifiedLabels.messages), ...toFieldItems(classifiedFields.messages)],
    [classifiedFields.messages, classifiedLabels.messages]
  );
  const other = useMemo(
    () => [...toLabelItems(classifiedLabels.other), ...toFieldItems(classifiedFields.other)],
    [classifiedFields.other, classifiedLabels.other]
  );
  const stacktraces = useMemo(
    () => [...toLabelItems(classifiedLabels.stacktraces), ...toFieldItems(classifiedFields.stacktraces)],
    [classifiedFields.stacktraces, classifiedLabels.stacktraces]
  );
  const errorDetails = useMemo(() => [...other, ...messages, ...stacktraces], [messages, other, stacktraces]);
  const diagnosePrompt = useMemo(
    () => buildDiagnoseErrorPrompt(errorDetails, otelLanguage),
    [errorDetails, otelLanguage]
  );
  const diagnoseContext = useMemo(
    () => (isAvailable ? buildDiagnoseErrorContext(errorDetails, otelLanguage) : []),
    [errorDetails, isAvailable, otelLanguage]
  );

  if (!errorDetails.length) {
    return null;
  }

  const reportDiagnose = () => {
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_error_diagnose_clicked');
    }
  };

  return (
    <div className={`${styles.container} ${className ? className : ''}`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Icon name="exclamation-circle" className={styles.icon} />
          <span>{t('logs.log-details.error.error-details', 'Error details')}</span>
        </div>
        {isAvailable && (
          <div className={styles.assistantAction}>
            <OpenAssistantButton
              origin="grafana/logs/diagnose-log-error"
              prompt={diagnosePrompt}
              context={diagnoseContext}
              autoSend
              title={t('logs.log-details.error.diagnose-with-assistant', 'Diagnose with assistant')}
              size="sm"
              onClick={reportDiagnose}
            />
          </div>
        )}
      </div>
      <div className={styles.content}>
        {other.map((item) => (
          <ErrorValue key={`other-${item.key}`} item={item} variant="message" />
        ))}
        {messages.map((item) => (
          <ErrorValue key={`message-${item.key}`} item={item} variant="message" />
        ))}
        {stacktraces.map((item) => (
          <StacktraceValue key={`stacktrace-${item.key}`} item={item} />
        ))}
      </div>
    </div>
  );
};

function knownOtelLanguage(otelLanguage?: string): string | undefined {
  const language = otelLanguage?.trim();
  if (!language || language === OTEL_LANGUAGE_UNKNOWN) {
    return undefined;
  }
  return language;
}

function buildDiagnoseErrorPrompt(items: ErrorDisplayItem[], otelLanguage?: string): string {
  const details = items.map((item) => `${item.key}: ${item.value.replaceAll('`', '\\`')}`).join('\n');
  const language = knownOtelLanguage(otelLanguage)?.replaceAll('`', '\\`');
  const source = language ? `an OpenTelemetry ${language} log line` : 'a log line';
  return `Diagnose this error from ${source}. Explain the likely cause and what to check next.\n\n\`\`\`\n${details}\n\`\`\``;
}

function buildDiagnoseErrorContext(items: ErrorDisplayItem[], otelLanguage?: string) {
  const language = knownOtelLanguage(otelLanguage);
  return [
    createAssistantContextItem('structured', {
      title: t('logs.log-details.error.error-details', 'Error details'),
      data: {
        ...(language ? { language } : {}),
        attributes: items.map((item) => ({ key: item.key, value: item.value })),
      },
    }),
  ];
}

function toFieldItems(fields: FieldDef[]): ErrorDisplayItem[] {
  return fields.map((field) => ({
    key: field.keys[0] ?? '',
    value: field.values[0] ?? '',
  }));
}

function toLabelItems(labels: LabelWithLinks[]): ErrorDisplayItem[] {
  return labels.map((label) => ({
    key: label.key,
    value: label.value,
  }));
}

function StacktraceValue({ item }: { item: ErrorDisplayItem }) {
  const { fontSize, noInteractions } = useLogListContext();
  const styles = useStyles2(getValueStyles, fontSize, 'stacktrace');
  const [isOpen, setIsOpen] = useState(false);
  const label = getNormalizedFieldName(item.key);

  const toggleStacktrace = () => {
    const state = isOpen ? 'closed' : 'open';
    setIsOpen(!isOpen);
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_error_stacktrace_toggled', { state });
    }
  };

  const copyStacktrace = () => {
    if (!noInteractions) {
      reportInteraction('logs_log_line_details_error_stacktrace_copied');
    }
  };

  return (
    <div className={styles.row}>
      <button type="button" className={styles.toggle} aria-expanded={isOpen} onClick={toggleStacktrace}>
        <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
        <span>{label}</span>
      </button>
      {isOpen && (
        <div className={styles.value}>
          <div className={styles.valueContent}>{item.value}</div>
          <div className={styles.actions}>
            <ClipboardButton
              getText={() => item.value}
              onClipboardCopy={copyStacktrace}
              aria-label={t('logs.log-line-details.fields.copy-value-to-clipboard', 'Copy value to clipboard')}
              fill="text"
              variant="secondary"
              icon="copy"
              size="sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorValue({
  item,
  variant,
}: {
  item: ErrorDisplayItem;
  variant: Exclude<ErrorAttributeVariant, 'stacktrace'>;
}) {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getValueStyles, fontSize, variant);

  return (
    <div className={styles.row}>
      <div className={styles.label}>{getNormalizedFieldName(item.key)}</div>
      <div className={styles.value}>
        <div className={styles.valueContent}>{item.value}</div>
        <div className={styles.actions}>
          <ClipboardButton
            getText={() => item.value}
            aria-label={t('logs.log-line-details.fields.copy-value-to-clipboard', 'Copy value to clipboard')}
            fill="text"
            variant="secondary"
            icon="copy"
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

type ErrorAttributeVariant = 'message' | 'stacktrace' | 'other';

const getStyles = (theme: GrafanaTheme2, fontSize: LogListFontSize) => ({
  container: css({
    background: `linear-gradient(${theme.colors.error.main}, ${theme.colors.error.main}) left 0 top 0 / 6px 100% no-repeat, ${theme.colors.background.secondary}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1),
    paddingLeft: `calc(6px + ${theme.spacing(1)})`,
  }),
  header: css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  }),
  headerTitle: css({
    alignItems: 'center',
    color: theme.colors.error.text,
    display: 'flex',
    fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : undefined,
    fontWeight: theme.typography.fontWeightMedium,
    gap: theme.spacing(0.5),
  }),
  assistantAction: css({
    marginLeft: 'auto',
  }),
  icon: css({
    flexShrink: 0,
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  otherFields: css({
    display: 'grid',
    gap: fontSize === 'small' ? theme.spacing(0.25, 0.5) : theme.spacing(0.5, 1),
    gridTemplateColumns: `fit-content(30%) 1fr`,
  }),
});

const getValueStyles = (theme: GrafanaTheme2, fontSize: LogListFontSize, variant: ErrorAttributeVariant) => {
  const actions = css({
    background: variant === 'stacktrace' ? theme.colors.background.canvas : theme.colors.background.primary,
    position: 'absolute',
    top: variant === 'stacktrace' ? theme.spacing(2.25) : 0,
    right: variant === 'stacktrace' ? theme.spacing(2.25) : 0,
    visibility: 'hidden',
    '& > button': {
      color: theme.colors.text.secondary,
      gap: 0,
      padding: 0,
      justifyContent: 'center',
      borderRadius: theme.shape.radius.default,
      height: theme.spacing(theme.components.height.sm),
      width: theme.spacing(theme.components.height.sm),
      svg: {
        margin: 0,
      },
    },
  });

  return {
    row: css({
      display: variant === 'other' ? 'contents' : 'flex',
      flexDirection: variant === 'other' ? undefined : 'column',
      gap: variant === 'other' ? undefined : theme.spacing(0.5),
    }),
    label: css({
      color: theme.colors.text.secondary,
      paddingRight: theme.spacing(1),
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
    }),
    toggle: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: 0,
      border: 'none',
      background: 'none',
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      font: 'inherit',
      textAlign: 'left',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
    }),
    value: css({
      position: 'relative',
      minWidth: 0,
      [`&:hover .${actions}, &:focus-within .${actions}`]: {
        visibility: 'visible',
      },
    }),
    valueContent: css({
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxHeight: variant === 'stacktrace' ? theme.spacing(30) : '50vh',
      overflow: 'auto',
      ...(variant === 'message'
        ? {
            fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : theme.typography.body.fontSize,
            fontWeight: theme.typography.fontWeightMedium,
          }
        : {}),
      ...(variant === 'stacktrace'
        ? {
            fontFamily: theme.typography.fontFamilyMonospace,
            fontSize: theme.typography.bodySmall.fontSize,
            background: theme.colors.background.canvas,
            border: `1px solid ${theme.colors.border.medium}`,
            borderRadius: theme.shape.radius.default,
            padding: theme.spacing(1),
            margin: theme.spacing(1),
          }
        : {}),
    }),
    actions,
  };
};
