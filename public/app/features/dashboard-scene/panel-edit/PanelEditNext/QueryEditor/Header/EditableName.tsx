import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Input, FieldValidationMessage, Icon, Text } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

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
      <span className={styles.hoverAction}>
        <Icon name="pen" size="sm" />
      </span>
    </button>
  );
}

function isSidebarCardElement(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest(`[${SIDEBAR_CARD_DATA_ATTR}]`) !== null;
}

const getStyles = (theme: GrafanaTheme2) => {
  // Keep on a plain element: Icon runs className through emotion's cx, which merges
  // registered classes into a new one, so this name would never reach the DOM.
  const hoverAction = css({
    display: 'flex',
    color: theme.colors.text.secondary,
    opacity: 0,
    [theme.transitions.handleMotion('no-preference')]: {
      transform: `translateX(${theme.spacing(1)})`,
      transition: theme.transitions.create(['opacity', 'transform']),
    },
    [theme.transitions.handleMotion('reduce')]: {
      transition: theme.transitions.create('opacity'),
    },
  });

  return {
    nameWrapper: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
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

      '&:focus-visible': getFocusStyles(theme),

      [`&:hover .${hoverAction}, &:focus-visible .${hoverAction}`]: {
        opacity: 1,
        transform: 'translateX(0)',
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
