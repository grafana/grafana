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
  /** Copy a URL reproducing the current customisation, so it can be shared */
  onCopyShareLink?: () => void;
}

/** The mega menu footer controls shown while customising: Reset / Copy link / Cancel / Done. */
export function MegaMenuCustomiseControls({
  canReset,
  onResetToDefault,
  onCancelEdit,
  onSaveEdit,
  onCopyShareLink,
}: Props) {
  return (
    <Stack alignItems="center" gap={1}>
      {canReset && (
        <IconButton
          name="history"
          tooltip={t('navigation.megamenu.customise-reset', 'Reset navigation - show all items and reset order')}
          onClick={onResetToDefault}
          variant="destructive"
        />
      )}
      <IconButton
        name="share-alt"
        tooltip={t('navigation.megamenu.customise-share', 'Copy a shareable link to this navigation customisation')}
        onClick={onCopyShareLink}
      />
      <Button size="sm" variant="secondary" fill="text" onClick={onCancelEdit}>
        {t('navigation.megamenu.customise-cancel', 'Cancel')}
      </Button>
      <Button size="sm" variant="primary" onClick={onSaveEdit}>
        {t('navigation.megamenu.customise-done', 'Done')}
      </Button>
    </Stack>
  );
}
