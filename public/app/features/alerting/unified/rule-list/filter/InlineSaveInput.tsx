import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, IconButton, Input, Stack, Text, useStyles2 } from '@grafana/ui';

import { SavedSearch, ValidationError, validateSearchName } from './SavedSearches.types';

// ============================================================================
// Inline Save Input (compact input with icon buttons)
// ============================================================================

export interface InlineSaveInputProps {
  onSave: (name: string) => Promise<ValidationError | void>;
  onCancel: () => void;
  savedSearches: SavedSearch[];
}

interface FormValues {
  name: string;
}

export function InlineSaveInput({ onSave, onCancel, savedSearches }: InlineSaveInputProps) {
  const styles = useStyles2(getStyles);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: '' },
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = async (data: FormValues) => {
    const validationError = validateSearchName(data.name, savedSearches);
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
      {/* Match exact structure of SavedSearchItem: [flex-1 content] [icon] [icon] with gap={1} */}
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

          {/* X icon - aligned with magnifying glass */}
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

          {/* Check icon - aligned with action menu */}
          {/* Note: IconButton doesn't forward type="submit", so we use onClick with handleSubmit */}
          <IconButton
            name="check"
            aria-label={t('alerting.saved-searches.save-button', 'Save')}
            disabled={isSubmitting}
            tooltip={t('alerting.saved-searches.save-button', 'Save')}
            className={styles.successIcon}
            size="md"
            variant="secondary"
            onClick={handleSubmit(onSubmit)}
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
