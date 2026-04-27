import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { IconButton, Spinner, Stack, Text } from '@grafana/ui';
import { ConfirmContent, type ConfirmContentProps } from '@grafana/ui/internal';
import { useStyles2 } from '@grafana/ui/themes';

export function ShareDrawerConfirmAction({
  onConfirm,
  onDismiss,
  description,
  confirmButtonLabel,
  title,
  isActionLoading,
}: { title: string; isActionLoading: boolean } & Pick<
  ConfirmContentProps,
  'description' | 'onConfirm' | 'onDismiss' | 'confirmButtonLabel'
>) {
  const styles = useStyles2(getStyles);

  const ConfirmBody = () => (
    <div className={styles.bodyContainer}>
      <Stack justifyContent="space-between">
        <Stack gap={1} alignItems="center">
          <IconButton
            size="xl"
            name="angle-left"
            aria-label={t('share-drawer.confirm-action.back-arrow-button', 'Back button')}
            onClick={onDismiss}
          />
          <Text variant="h4">{title}</Text>
        </Stack>
        {isActionLoading && <Spinner />}
      </Stack>
    </div>
  );

  return (
    <ConfirmContent
      body={<ConfirmBody />}
      description={description}
      confirmButtonLabel={confirmButtonLabel}
      confirmButtonVariant="destructive"
      dismissButtonLabel={t('share-drawer.confirm-action.cancel-button', 'Cancel')}
      dismissButtonVariant="secondary"
      justifyButtons="flex-start"
      onConfirm={onConfirm}
      onDismiss={onDismiss}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bodyContainer: css({
    marginBottom: theme.spacing(2),
  }),
});
