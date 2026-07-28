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
  /** The save is in flight — show a spinner on Done and lock the controls */
  saving?: boolean;
}

/** The mega menu header controls shown while customising: Reset / Cancel / Done. */
export function MegaMenuCustomiseControls({ canReset, onResetToDefault, onCancelEdit, onSaveEdit, saving }: Props) {
  return (
    <Stack alignItems="center" gap={1}>
      {canReset && (
        <IconButton
          name="history"
          tooltip={t(
            'navigation.megamenu.customise-reset',
            'Reset navigation - show all items, unpin all and reset order'
          )}
          onClick={onResetToDefault}
          variant="destructive"
          disabled={saving}
        />
      )}
      <Button size="sm" variant="secondary" fill="text" onClick={onCancelEdit} disabled={saving}>
        {t('navigation.megamenu.customise-cancel', 'Cancel')}
      </Button>
      <Button size="sm" variant="primary" onClick={onSaveEdit} icon={saving ? 'spinner' : undefined} disabled={saving}>
        {saving
          ? t('navigation.megamenu.customise-saving', 'Saving…')
          : t('navigation.megamenu.customise-done', 'Done')}
      </Button>
    </Stack>
  );
}
