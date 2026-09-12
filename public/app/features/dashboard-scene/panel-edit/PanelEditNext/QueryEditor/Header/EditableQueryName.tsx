import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { useStyles2, Input, FieldValidationMessage, Icon, Text } from '@grafana/ui';

import { SIDEBAR_CARD_DATA_ATTR } from '../../constants';
import { trackRenameInitiated } from '../../tracking';

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
    trackRenameInitiated();
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

  const onEditQueryBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Switching cards should cancel in-progress rename edits.
    if (isSidebarCardElement(event.relatedTarget)) {
      setIsEditing(false);
      setValidationError(null);
      return;
    }

    // Any other blur should finish the edit flow (validate + optional rename).
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
        <Text color="primary" element="p" truncate variant="body">
          {query.refId}
        </Text>
      </span>
      <div className={styles.hoverAction}>
        <Icon name="pen" size="sm" />
      </div>
    </button>
  );
}

function isSidebarCardElement(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest(`[${SIDEBAR_CARD_DATA_ATTR}]`) !== null;
}

const getStyles = (theme: GrafanaTheme2) => {
  const fadeToHoverBackground = [
    `linear-gradient(270deg, ${theme.colors.action.hover} 80%, transparent)`,
    `linear-gradient(270deg, ${theme.colors.background.secondary} 80%, transparent)`,
  ].join(', ');

  // Keep on a plain element: Icon runs className through emotion's cx, which merges
  // registered classes into a new one, so this name would never reach the DOM.
  const hoverAction = css({
    position: 'absolute',
    inset: '0 0 0 auto',
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 0.5, 0, 1.5),
    color: theme.colors.text.secondary,
    background: fadeToHoverBackground,
    opacity: 0,
    transform: 'translateX(8px)',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['opacity', 'transform']),
    },
  });

  return {
    queryNameWrapper: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      // Dashed at rest so hover only changes the color; border-style cannot transition.
      border: '1px dashed transparent',
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.5, 1),
      margin: 0,
      background: 'transparent',
      overflow: 'hidden',
      textAlign: 'left',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'border-color']),
      },

      '&:hover': {
        background: theme.colors.action.hover,
        borderColor: theme.colors.border.strong,
      },

      '&:focus-visible': {
        border: `2px solid ${theme.colors.primary.border}`,
      },

      [`&:hover .${hoverAction}, &:focus-visible .${hoverAction}`]: {
        opacity: 1,
        transform: 'translateX(0)',
      },
    }),
    queryNameText: css({
      display: 'block',
      maxWidth: '180px',
      // Keeps a single-character refId clear of the icon and its gradient.
      minWidth: theme.spacing(4),
      overflow: 'hidden',
    }),
    queryNameInput: css({
      maxWidth: '300px',

      input: {
        fontFamily: theme.typography.fontFamily,
      },
    }),
    inputRow: css({
      position: 'relative',
    }),
    hoverAction,
    validationMessage: css({
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: theme.spacing(0.5),
      whiteSpace: 'normal',
      maxWidth: 'min(360px, 40vw)',
      zIndex: theme.zIndex.tooltip,
    }),
  };
};
