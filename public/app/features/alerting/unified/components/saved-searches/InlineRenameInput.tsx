import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, IconButton, Input, Stack, Text, useStyles2 } from '@grafana/ui';

import { useAppNotification } from '../../../../../core/copy/appNotification';

import { SavedSearch, isValidationError, validateSearchName } from './savedSearchesSchema';

// ============================================================================
// Inline Rename Input (compact input with icon buttons for renaming)
// ============================================================================

export interface InlineRenameInputProps {
  initialValue: string;
  /** Callback to save the renamed search. Throws ValidationError on validation failure. */
  onSave: (name: string) => Promise<void>;
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
  const notifyApp = useAppNotification();

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: initialValue },
  });

  // Focus and select input on mount using react-hook-form's setFocus
  useEffect(() => {
    setFocus('name', { shouldSelect: true });
  }, [setFocus]);

  const onSubmit = async (data: FormValues) => {
    try {
      await onSave(data.name.trim());
    } catch (error) {
      // Check if it's a validation error (has field and message)
      if (isValidationError(error)) {
        // Validation errors are shown inline in the form
        // This is handled by react-hook-form validation, but we keep this
        // as a fallback for server-side validation errors
        return;
      }
      // For generic save operation errors, show a notification
      notifyApp.error(
        t('alerting.saved-searches.error-rename-title', 'Failed to rename'),
        t('alerting.saved-searches.error-rename-description', 'Your changes could not be saved. Please try again.')
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Stack direction="column" gap={0.5}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          {/* Input area - flex=1 like the name area in list items */}
          <Box flex={1} marginRight={2}>
            <Input
              {...register('name', {
                required: t('alerting.saved-searches.error-name-required', 'Name is required'),
                validate: (value) => {
                  const error = validateSearchName(value, savedSearches, excludeId);
                  return error ?? true;
                },
              })}
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
          {/* Note: IconButton doesn't forward type="submit", so we use onClick with handleSubmit */}
          <IconButton
            name="check"
            aria-label={t('alerting.saved-searches.rename-button', 'Rename')}
            disabled={isSubmitting}
            size="md"
            tooltip={t('alerting.saved-searches.rename-button', 'Rename')}
            className={styles.successIcon}
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
