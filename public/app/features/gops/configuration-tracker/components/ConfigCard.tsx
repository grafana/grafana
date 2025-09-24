// ConfigCard.tsx
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Icon, LoadingPlaceholder, Stack, useStyles2 } from '@grafana/ui';

import { IrmCardConfiguration } from './ConfigureIRM';
import { ProgressBar, StepsStatus } from './ProgressBar';

interface ConfigCardProps {
  config: IrmCardConfiguration;
  handleActionClick: (id: number, isDone: boolean | undefined) => void;
  isLoading: boolean;
}

export function ConfigCard({ config, handleActionClick, isLoading = false }: ConfigCardProps) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction={'column'} gap={1} justifyContent={'space-around'}>
      <div className={styles.cardContent}>
        <Stack direction={'column'} gap={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <div className="fs-unmask">
              <Stack direction={'row'} gap={1} alignItems={'center'}>
                {config.title}
                {config.titleIcon && <Icon name={config.titleIcon} />}
                {/* Only show check icon when not loading */}
                {config.isDone && !isLoading && <Icon name="check-circle" color="green" size="lg" />}
              </Stack>
            </div>
            {config.stepsDone && config.totalStepsToDo && !isLoading && (
              <div className="fs-unmask">
                <Stack direction="row" gap={0.5}>
                  <StepsStatus stepsDone={config.stepsDone} totalStepsToDo={config.totalStepsToDo} />
                  <Trans i18nKey="configuration-tracker.config-card.complete">complete</Trans>
                </Stack>
              </div>
            )}
          </Stack>
          <Stack direction={'column'}>
            {!isLoading ? (
              config.description
            ) : (
              <LoadingPlaceholder
                text={t('gops.config-card.text-loading-configuration', 'Loading configuration....')}
              />
            )}
            {/* Only show ProgressBar when not loading */}
            {!isLoading && config.stepsDone && config.totalStepsToDo && (
              <ProgressBar stepsDone={config.stepsDone} totalStepsToDo={config.totalStepsToDo} />
            )}
          </Stack>
        </Stack>
        <Stack direction={'row'} gap={1} justifyContent={'flex-start'} alignItems={'flex-end'}>
          <Button variant="secondary" onClick={() => handleActionClick(config.id, config.isDone)} className="fs-unmask">
            {config.actionButtonTitle}
          </Button>
        </Stack>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  cardTitle: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  }),
  cardContent: css({
    background: theme.colors.background.secondary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    height: '100%',
    gap: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  }),
});
