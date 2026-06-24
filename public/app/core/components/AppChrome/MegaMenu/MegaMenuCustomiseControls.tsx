import { t } from '@grafana/i18n';
import { Button, IconButton, Stack } from '@grafana/ui';

interface Props {
  /** There is staged customisation to clear — show the Reset control */
  canReset?: boolean;
  /** Stage a reset of all customisation back to defaults */
  onResetToDefault?: () => void;
  /** Discard the staged customisation and leave customise mode */
  onCancelEdit?: () => void;
  /** Save the staged customisation and leave customise mode */
  onSaveEdit?: () => void;
}

/** The mega menu header controls shown while customising: Reset / Cancel / Done. */
export function MegaMenuCustomiseControls({ canReset, onResetToDefault, onCancelEdit, onSaveEdit }: Props) {
  return (
    <Stack alignItems="center" gap={1}>
      {canReset && (
        <IconButton
          name="history"
          tooltip={t('navigation.megamenu.customise-reset', 'Reset to default')}
          onClick={onResetToDefault}
          variant="secondary"
        />
      )}
      <Button size="sm" variant="secondary" fill="text" onClick={onCancelEdit}>
        {t('navigation.megamenu.customise-cancel', 'Cancel')}
      </Button>
      <Button size="sm" variant="primary" onClick={onSaveEdit}>
        {t('navigation.megamenu.customise-done', 'Done')}
      </Button>
    </Stack>
  );
}
