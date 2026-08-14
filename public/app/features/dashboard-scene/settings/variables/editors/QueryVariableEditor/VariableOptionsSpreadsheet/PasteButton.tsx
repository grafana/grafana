import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { type ClipboardAccess, type ClipboardTextFormat } from './clipboard';

interface PasteButtonProps {
  canPaste: boolean;
  onClick: () => void;
  clipboardAccess: ClipboardAccess;
  textFormat: ClipboardTextFormat;
}

export function PasteButton({ canPaste, onClick, clipboardAccess, textFormat }: PasteButtonProps) {
  const { label, tooltip } = getPasteButtonProps(clipboardAccess, textFormat, canPaste);

  return (
    <Button
      icon="clipboard-alt"
      variant="primary"
      fill="text"
      disabled={!canPaste}
      onClick={onClick}
      aria-label={label}
      tooltip={tooltip}
    >
      {label}
    </Button>
  );
}

function getPasteButtonProps(
  clipboardAccess: ClipboardAccess,
  textFormat: ClipboardTextFormat,
  canPaste: boolean
): { label: string; tooltip?: string } {
  const pasteLabel =
    canPaste && textFormat
      ? t(
          'dashboard-scene.query-variable-editor.spreadsheet.paste-from-clipboard-with-format',
          'Paste from clipboard ({{format}})',
          { format: textFormat.toUpperCase() }
        )
      : t('dashboard-scene.query-variable-editor.spreadsheet.paste-from-clipboard', 'Paste from clipboard');

  switch (clipboardAccess) {
    // Same "paste" label as everywhere else: clicking both grants the permission and pastes,
    // so only the tooltip announces the upcoming browser prompt
    case 'prompt':
      return {
        label: pasteLabel,
        tooltip: t(
          'dashboard-scene.query-variable-editor.spreadsheet.enable-copy-paste-tooltip',
          'Your browser will ask for permission to read your clipboard'
        ),
      };
    case 'denied':
      return {
        label: pasteLabel,
        tooltip: t(
          'dashboard-scene.query-variable-editor.spreadsheet.clipboard-access-blocked',
          "Clipboard access is blocked. Enable it in your browser's site settings."
        ),
      };
    // 'granted' and 'gesture-only': no persistent permission left to enable, so the generic
    // paste label applies; gesture-only browsers rely on their native per-use paste prompt
    default:
      return {
        label: pasteLabel,
        tooltip: undefined,
      };
  }
}
