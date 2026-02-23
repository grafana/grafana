import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { useStyles2, Input, FieldValidationMessage, Icon, Text } from '@grafana/ui';

interface EditableQueryNameProps {
  query: DataQuery;
  queries: DataQuery[];
  onQueryUpdate: (updatedQuery: DataQuery, originalRefId: string) => void;
}

export function EditableQueryName({ query, queries, onQueryUpdate }: EditableQueryNameProps) {
  const styles = useStyles2(getStyles);

  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const existingRefIds = useMemo(
    () => new Set(queries.filter((q) => q.refId !== query.refId).map((q) => q.refId)),
    [queries, query.refId]
  );

  const onEditQuery = () => {
    setIsEditing(true);
    setValidationError(null);
  };

  const validateQueryName = (name: string): string | null => {
    if (name === query.refId) {
      return null;
    }

    if (name.length === 0) {
      return t('query-editor-next.validation.empty-name', 'An empty query name is not allowed');
    }

    if (existingRefIds.has(name)) {
      return t('query-editor-next.validation.duplicate-name', 'Query name already exists');
    }

    return null;
  };

  const onEndEditName = (newName: string) => {
    setIsEditing(false);
    setValidationError(null);

    const trimmedName = newName.trim();

    if (validateQueryName(trimmedName)) {
      return;
    }

    if (query.refId !== trimmedName) {
      onQueryUpdate({ ...query, refId: trimmedName }, query.refId);
    }
  };

  const onInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newName = event.currentTarget.value;
    const error = validateQueryName(newName);
    setValidationError(error);
  };

  const onEditQueryBlur = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onEndEditName(event.currentTarget.value);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const trimmedName = event.currentTarget.value.trim();
      const error = validateQueryName(trimmedName);

      if (error) {
        setValidationError(error);
        return;
      }

      onEndEditName(event.currentTarget.value);
    } else if (event.key === 'Escape') {
      event.stopPropagation(); // Prevent going all the way back to the dashboard scene
      setIsEditing(false);
      setValidationError(null);
    }
  };

  const onFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  if (isEditing) {
    return (
      <div className={styles.inputRow}>
        <Input
          type="text"
          defaultValue={query.refId}
          onBlur={onEditQueryBlur}
          autoFocus
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onChange={onInputChange}
          invalid={validationError !== null}
          className={styles.queryNameInput}
          data-testid="query-name-input"
        />
        {validationError && (
          <FieldValidationMessage className={styles.validationMessage}>{validationError}</FieldValidationMessage>
        )}
      </div>
    );
  }

  return (
    <button
      className={styles.queryNameWrapper}
      onClick={onEditQuery}
      type="button"
      aria-label={t('query-editor-next.edit-query-name', 'Edit query name')}
      title={t('query-editor-next.edit-query-name', 'Edit query name')}
    >
      <span className={styles.queryNameText}>
        <Text color="primary" element="p" truncate variant="code">
          {query.refId}
        </Text>
      </span>
      <Icon name="pen" className={styles.queryEditIcon} data-edit-icon size="sm" />
    </button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  queryNameWrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    cursor: 'pointer',
    border: '1px solid transparent',
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0, 0.5),
    margin: 0,
    background: 'transparent',
    overflow: 'hidden',

    '&:hover': {
      background: theme.colors.action.hover,
      border: `1px dashed ${theme.colors.border.strong}`,
    },

    '&:focus-visible': {
      border: `2px solid ${theme.colors.primary.border}`,
    },
  }),
  queryNameText: css({
    display: 'block',
    maxWidth: '180px',
    minWidth: 0,
    overflow: 'hidden',
  }),
  queryNameInput: css({
    maxWidth: '300px',

    input: {
      fontFamily: theme.typography.fontFamilyMonospace,
    },
  }),
  inputRow: css({
    position: 'relative',
  }),
  queryEditIcon: css({
    color: theme.colors.text.secondary,
  }),
  validationMessage: css({
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: theme.spacing(0.5),
    whiteSpace: 'normal',
    maxWidth: 'min(360px, 40vw)',
    zIndex: theme.zIndex.tooltip,
  }),
});
