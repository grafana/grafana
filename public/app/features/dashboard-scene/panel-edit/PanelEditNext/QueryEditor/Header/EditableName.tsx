import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Input, FieldValidationMessage, Icon, Text } from '@grafana/ui';

import { SIDEBAR_CARD_DATA_ATTR } from '../../constants';

interface EditableNameProps {
  /** The committed name, and what the input starts from. Empty shows `placeholder` instead. */
  value: string;
  /** Shown in place of an empty value, de-emphasised. */
  placeholder?: string;
  /** Returns an error to display, or null when `name` may be committed. */
  validate: (name: string) => string | null;
  /** Called with the trimmed name once it validates and differs from `value`. */
  onCommit: (name: string) => void;
  /** Labels the button and the edit affordance for screen readers. */
  label: string;
  onEditStart?: () => void;
  'data-testid'?: string;
  inputTestId?: string;
}

/**
 * Click-to-rename used by the query and transformation headers. Blur commits, Escape abandons.
 */
export function EditableName({
  value,
  placeholder,
  validate,
  onCommit,
  label,
  onEditStart,
  'data-testid': testId,
  inputTestId,
}: EditableNameProps) {
  const styles = useStyles2(getStyles);

  const [isEditing, setIsEditing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onEditStarted = () => {
    onEditStart?.();
    setIsEditing(true);
    setValidationError(null);
  };

  const onEndEdit = (newName: string) => {
    setIsEditing(false);
    setValidationError(null);

    const trimmed = newName.trim();

    if (validate(trimmed) !== null) {
      return;
    }

    if (trimmed !== value) {
      onCommit(trimmed);
    }
  };

  const onInputChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    setValidationError(validate(event.currentTarget.value.trim()));
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Switching cards should cancel in-progress rename edits.
    if (isSidebarCardElement(event.relatedTarget)) {
      setIsEditing(false);
      setValidationError(null);
      return;
    }

    onEndEdit(event.currentTarget.value);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const trimmed = event.currentTarget.value.trim();
      const error = validate(trimmed);

      if (error) {
        setValidationError(error);
        return;
      }

      onEndEdit(event.currentTarget.value);
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
          defaultValue={value}
          onBlur={onBlur}
          autoFocus
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onChange={onInputChange}
          invalid={validationError !== null}
          className={styles.nameInput}
          data-testid={inputTestId}
        />
        {validationError && (
          <FieldValidationMessage className={styles.validationMessage}>{validationError}</FieldValidationMessage>
        )}
      </div>
    );
  }

  return (
    <button
      className={styles.nameWrapper}
      onClick={onEditStarted}
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      <span className={cx(styles.nameText, !value && styles.placeholderText)}>
        <Text color={value ? 'primary' : 'secondary'} element="p" truncate variant="body">
          {value || placeholder || ''}
        </Text>
      </span>
      <Icon name="pen" className={styles.editIcon} data-edit-icon size="sm" />
    </button>
  );
}

function isSidebarCardElement(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest(`[${SIDEBAR_CARD_DATA_ATTR}]`) !== null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  nameWrapper: css({
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
  nameText: css({
    display: 'block',
    maxWidth: '180px',
    minWidth: 0,
    overflow: 'hidden',
  }),
  placeholderText: css({
    fontStyle: 'italic',
  }),
  nameInput: css({
    maxWidth: '300px',

    input: {
      fontFamily: theme.typography.fontFamily,
    },
  }),
  inputRow: css({
    position: 'relative',
  }),
  editIcon: css({
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
