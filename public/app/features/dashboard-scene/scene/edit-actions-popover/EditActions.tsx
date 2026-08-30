import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, IconButton, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { useEditActionsPopover } from './EditActionsPopover';

export function SettingsActionButton({ onClick }: { onClick: () => void }) {
  const styles = useStyles2(getActionStyles);
  return (
    <Button
      fill="text"
      variant="secondary"
      size="sm"
      className={cx(styles.action, styles.textAction)}
      onClick={onClick}
    >
      {t('dashboard-scene.control-edit-actions.settings', 'Settings')}
    </Button>
  );
}

export const SHOW_COPIED_DURATION_MS = 2000;

export function CopyActionButton({ onClick, isRepeated }: { onClick: () => void; isRepeated?: boolean }) {
  const styles = useStyles2(getActionStyles);
  const [copied, setCopied] = useState(false);
  const tooltip = isRepeated
    ? t('dashboard-scene.control-edit-actions.copied-tooltip-disabled', "Repeated panels can't be copied individually")
    : t('dashboard-scene.control-edit-actions.copy-clipboard-tooltip', 'Copy to clipboard');

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCopied(false), SHOW_COPIED_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  return (
    <Tooltip
      content={copied ? t('clipboard-button.inline-toast.success', 'Copied') : tooltip}
      show={copied ? true : undefined}
      placement="top"
    >
      <IconButton
        name="clipboard-alt"
        variant="secondary"
        size="md"
        className={styles.action}
        aria-label={tooltip}
        onClick={() => {
          onClick();
          setCopied(true);
        }}
        disabled={isRepeated}
      />
    </Tooltip>
  );
}

export function DuplicateActionButton({ onClick, isRepeated }: { onClick: () => void; isRepeated?: boolean }) {
  const styles = useStyles2(getActionStyles);

  const tooltip = isRepeated
    ? t(
        'dashboard-scene.control-edit-actions.duplicate-tooltip-disabled',
        "Repeated panels can't be duplicated individually"
      )
    : t('dashboard-scene.control-edit-actions.duplicate-tooltip', 'Duplicate');

  return (
    <IconButton
      name="copy"
      variant="secondary"
      size="md"
      className={styles.action}
      onClick={onClick}
      tooltip={tooltip}
      tooltipPlacement="top"
      disabled={isRepeated}
    />
  );
}

export function DeleteActionButton({
  title,
  text,
  yesText,
  onConfirm,
  isRepeated,
}: {
  title: string;
  text: string;
  yesText: string;
  onConfirm: () => void;
  isRepeated?: boolean;
}) {
  const styles = useStyles2(getActionStyles);
  const { closePopover } = useEditActionsPopover();

  const onClickInternal = useCallback(() => {
    closePopover();
    appEvents.publish(
      new ShowConfirmModalEvent({
        title,
        text,
        yesText,
        onConfirm,
      })
    );
  }, [closePopover, title, text, yesText, onConfirm]);

  const tooltip = isRepeated
    ? t('dashboard-scene.control-edit-actions.delete-tooltip-disabled', "Repeated panels can't be deleted individually")
    : t('dashboard-scene.control-edit-actions.delete-tooltip', 'Delete');

  return (
    <IconButton
      name="trash-alt"
      variant="destructive"
      size="md"
      className={cx(styles.action, styles.deleteAction)}
      onClick={onClickInternal}
      tooltip={tooltip}
      tooltipPlacement="top"
      disabled={isRepeated}
    />
  );
}

export const getActionStyles = (theme: GrafanaTheme2) => ({
  action: css({
    margin: 0,
    color: theme.colors.text.primary,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['color'], {
        duration: theme.transitions.duration.short,
      }),
    },
    '&:hover, &:focus': {
      color: theme.colors.text.maxContrast,
      background: 'transparent',
    },
    '&:hover:before': {
      opacity: 0,
    },
  }),
  textAction: css({
    padding: 0,
    height: 'auto',
    fontWeight: theme.typography.fontWeightRegular,
  }),
  deleteAction: css({
    '&:hover': {
      color: theme.colors.error.text,
    },
  }),
  actionsDivider: css({
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border.medium,
  }),
});
