import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

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

export function InlineRenameInput({
  initialValue,
  onSave,
  onCancel,
  savedSearches,
  excludeId,
}: InlineRenameInputProps) {
  const styles = useStyles2(getStyles);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Clear error when value changes
  useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [value, error]);

  const handleSubmit = async () => {
    const validationError = validateSearchName(value, savedSearches, excludeId);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSave(value.trim());
      if (result?.message) {
        setError(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" alignItems="center" gap={1} wrap={false}>
        {/* Input area - flex=1 like the name area in list items */}
        <Box flex={1} marginRight={2}>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('alerting.saved-searches.name-placeholder', 'Enter a name...')}
            invalid={!!error}
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
        />

        {/* Check icon - confirm rename */}
        <IconButton
          name="check"
          aria-label={t('alerting.saved-searches.rename-button', 'Rename')}
          onClick={handleSubmit}
          disabled={isSubmitting}
          size="md"
          tooltip={t('alerting.saved-searches.rename-button', 'Rename')}
          className={styles.successIcon}
          variant="secondary"
        />
      </Stack>
      {error && (
        <Text color="error" variant="bodySmall">
          {error}
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
