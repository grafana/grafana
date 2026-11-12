import { css } from '@emotion/css';
import { type PointerEvent as ReactPointerEvent, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Card, Icon, IconButton, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { getPreviewAssetsFolder } from 'app/core/utils/previewAssets';

import { FeatureControlFlag } from './FeatureControlFlag';
import { useFeatureControlContext } from './FeatureControlProvider';
import { PreviewAssetsMessage } from './PreviewAssetsMessage';

type FeatureControlFlagsProps = {
  /** Pointer-down handler used to start dragging the panel from its header. */
  onDragHandleDown?: (event: ReactPointerEvent) => void;
};

export const FeatureControlFlags = ({ onDragHandleDown }: FeatureControlFlagsProps) => {
  const { setIsOpen, setIsAccessible, overrides, isSuspended, resetToDefaults, restoreOverrides } =
    useFeatureControlContext();
  const styles = useStyles2(getStyles);
  const previewAssetsFolder = getPreviewAssetsFolder();
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <Card noMargin className={styles.card}>
      <div className={onDragHandleDown ? styles.dragHandle : undefined} onPointerDown={onDragHandleDown}>
        <Stack direction="row" alignItems="center">
          <Icon name="flask" size="xl" />
          <Text variant="h4">
            <Trans i18nKey="feature-control.title">Feature control</Trans>
          </Text>

          <IconButton
            tooltip={t('feature-control.close', 'Close')}
            variant="secondary"
            name="times"
            className={styles.close}
            onClick={() => setIsOpen(false)}
          />
        </Stack>
      </div>
      <Text variant="body" color="secondary">
        <Trans i18nKey="feature-control.description">
          Override frontend feature flags locally for testing and development purposes.
        </Trans>
      </Text>

      {isSuspended && (
        <div className={styles.suspendedStatus} role="status">
          <Icon name="exclamation-triangle" className={styles.suspendedIcon} />
          <div className={styles.suspendedText}>
            <Text variant="bodySmall" weight="medium">
              <Trans i18nKey="feature-control.suspended-warning">Overrides are temporarily disabled</Trans>
            </Text>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="feature-control.suspended-warning-body">
                Flags are evaluating to their default values. Restore overrides to re-enable them.
              </Trans>
            </Text>
          </div>
        </div>
      )}

      {previewAssetsFolder && <PreviewAssetsMessage previewAssetsFolder={previewAssetsFolder} />}

      <div className={styles.list}>
        {overrides.map((flag) => (
          <FeatureControlFlag key={flag.key} flag={flag} disabled={isSuspended} />
        ))}
        {showNewForm && !isSuspended && (
          <FeatureControlFlag alwaysOpen autoFocus onDone={() => setShowNewForm(false)} />
        )}
      </div>

      <Stack direction="column" gap={1}>
        {!showNewForm && !isSuspended && (
          <Button icon="plus" variant="secondary" fullWidth onClick={() => setShowNewForm(true)}>
            {t('feature-control.add-new-flag', 'Add new flag override')}
          </Button>
        )}

        <Stack direction="row" gap={1}>
          {isSuspended ? (
            <Button className={styles.bottomButton} variant="secondary" icon="history" onClick={restoreOverrides}>
              {t('feature-control.restore-overrides', 'Restore overrides')}
            </Button>
          ) : (
            <Button
              className={styles.bottomButton}
              variant="secondary"
              icon="history"
              onClick={resetToDefaults}
              disabled={overrides.length === 0}
            >
              {t('feature-control.disable-overrides', 'Disable overrides')}
            </Button>
          )}

          <Tooltip
            content={
              <Trans i18nKey="feature-control.dismiss.tooltip" values={{ param: '?featureControl=true' }}>
                Any feature flag overrides defined will remain active.
                <br /> Use <code>{'{{ param }}'}</code> in the URL to enable UI again.
              </Trans>
            }
          >
            <Button
              className={styles.bottomButton}
              variant="destructive"
              fill="outline"
              icon="trash-alt"
              onClick={() => {
                setIsOpen(false);
                setIsAccessible(false);
              }}
            >
              {t('feature-control.dismiss.label', 'Remove UI and toolbar button')}
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
    </Card>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: theme.spacing(64),
    boxShadow: theme.shadows.z2,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  close: css({
    marginLeft: 'auto',
  }),
  suspendedStatus: css({
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary,
    borderLeft: `3px solid ${theme.colors.warning.border}`,
    borderRadius: theme.shape.radius.default,
  }),
  suspendedIcon: css({
    color: theme.colors.warning.text,
  }),
  suspendedText: css({
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  }),
  bottomButton: css({
    flex: '1 1 0',
    justifyContent: 'center',
  }),
  dragHandle: css({
    cursor: 'move',
    userSelect: 'none',
    touchAction: 'none',
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 0, 1),
    width: '100%',
  }),
});
