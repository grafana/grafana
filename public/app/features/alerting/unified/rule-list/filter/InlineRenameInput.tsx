import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, IconButton, Input, Stack, Text, useStyles2 } from '@grafana/ui';

import { SavedSearch, ValidationError, validateSearchName } from './SavedSearches.types';

// ============================================================================
// Inline Rename Input (compact input with icon buttons for renaming)
// ============================================================================

export interface InlineRenameInputProps {
  initialValue: string;
  onSave: (name: string) => Promise<ValidationError | void>;
  onCancel: () => void;
  savedSearches: SavedSearch[];
  excludeId: string;
}

interface FormValues {
  name: string;
}

export function InlineRenameInput({
  initialValue,
  onSave,
  onCancel,
  savedSearches,
  excludeId,
}: InlineRenameInputProps) {
  const styles = useStyles2(getStyles);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: initialValue },
  });

  // Focus and select input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const onSubmit = async (data: FormValues) => {
    const validationError = validateSearchName(data.name, savedSearches, excludeId);
    if (validationError) {
      setError('name', { message: validationError });
      return;
    }

    const result = await onSave(data.name.trim());
    if (result?.message) {
      setError('name', { message: result.message });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // Get the register props and merge with our ref
  const { ref: registerRef, ...registerProps } = register('name');

  return (
    <Stack direction="column" gap={0.5}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          {/* Input area - flex=1 like the name area in list items */}
          <Box flex={1} marginRight={2}>
            <Input
              {...registerProps}
              ref={(e) => {
                registerRef(e);
                // Store ref for focus management
                if (inputRef && 'current' in inputRef) {
                  inputRef.current = e;
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('alerting.saved-searches.name-placeholder', 'Enter a name...')}
              invalid={!!errors.name}
              disabled={isSubmitting}
            />
          </Box>

          {/* X icon - cancel */}
          <IconButton
            name="times"
            aria-label={t('alerting.saved-searches.cancel', 'Cancel')}
            onClick={onCancel}
            disabled={isSubmitting}
            tooltip={t('alerting.saved-searches.cancel', 'Cancel')}
            size="md"
            variant="secondary"
            type="button"
          />

          {/* Check icon - confirm rename */}
          <IconButton
            name="check"
            aria-label={t('alerting.saved-searches.rename-button', 'Rename')}
            disabled={isSubmitting}
            size="md"
            tooltip={t('alerting.saved-searches.rename-button', 'Rename')}
            className={styles.successIcon}
            variant="secondary"
            type="submit"
          />
        </Stack>
      </form>
      {errors.name?.message && (
        <Text color="error" variant="bodySmall">
          {errors.name.message}
        </Text>
      )}
    </Stack>
  );
}

// ============================================================================
// Styles
// ============================================================================

function getStyles(theme: GrafanaTheme2) {
  return {
    successIcon: css({
      color: theme.colors.success.main,
    }),
  };
}
