import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, Icon, useStyles2 } from '@grafana/ui';

import { type FieldDef } from '../logParser';
import { classifyErrorAttributes } from '../otel/details';

import { type LabelWithLinks } from './LogLineDetailsFields';
import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';
import { getNormalizedFieldName } from './processing';

interface LogLineOTelDetailsErrorProps {
  fields: FieldDef[];
  labels: LabelWithLinks[];
}

interface ErrorDisplayItem {
  key: string;
  value: string;
}

export const LogLineOTelDetailsError = ({ fields, labels }: LogLineOTelDetailsErrorProps) => {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getStyles, fontSize);

  const classifiedFields = useMemo(
    () => classifyErrorAttributes(fields, (field) => field.keys[0] ?? ''),
    [fields]
  );
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

  if (!messages.length && !other.length && !stacktraces.length) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Icon name="exclamation-circle" className={styles.icon} />
        <span>{t('explore.span-detail.attribute-category.error', 'Error')}</span>
      </div>
      <div className={styles.content}>
        {messages.map((item) => (
          <ErrorValue key={`message-${item.key}`} item={item} variant="message" />
        ))}
        {other.length > 0 && (
          <div className={styles.otherFields}>
            {other.map((item) => (
              <ErrorValue key={`other-${item.key}`} item={item} variant="other" />
            ))}
          </div>
        )}
        {stacktraces.map((item) => (
          <ErrorValue key={`stacktrace-${item.key}`} item={item} variant="stacktrace" />
        ))}
      </div>
    </div>
  );
};

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

function ErrorValue({ item, variant }: { item: ErrorDisplayItem; variant: ErrorAttributeVariant }) {
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
    background: theme.colors.error.transparent,
    border: `1px solid ${theme.colors.error.border}`,
    borderRadius: theme.shape.radius.default,
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
  }),
  header: css({
    alignItems: 'center',
    color: theme.colors.error.text,
    display: 'flex',
    fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : undefined,
    fontWeight: theme.typography.fontWeightMedium,
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
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
    background: variant === 'stacktrace' ? theme.colors.background.secondary : theme.colors.background.primary,
    position: 'absolute',
    top: variant === 'stacktrace' ? theme.spacing(0.5) : 0,
    right: variant === 'stacktrace' ? theme.spacing(0.5) : 0,
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
      maxHeight: variant === 'stacktrace' ? '40vh' : '50vh',
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
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border.medium}`,
            borderLeft: `3px solid ${theme.colors.error.border}`,
            borderRadius: theme.shape.radius.default,
            padding: theme.spacing(1),
          }
        : {}),
    }),
    actions,
  };
};
