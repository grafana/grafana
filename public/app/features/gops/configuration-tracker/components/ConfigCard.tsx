// ConfigCard.tsx
import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Icon, Stack, useStyles2 } from '@grafana/ui';

import { DataConfiguration } from './ConfigureIRM';
import { ProgressBar, StepsStatus } from './ProgressBar';

interface ConfigCardProps {
  config: DataConfiguration;
  handleActionClick: (id: number, isDone: boolean | undefined) => void;
}

export function ConfigCard({ config, handleActionClick }: ConfigCardProps) {
  const styles = useStyles2(getStyles);
  return (
    <Card>
      <Card.Heading className={styles.title}>
        <div className={styles.essentialsTitle}>
          <Stack direction={'row'} gap={1}>
            {config.title}
            {config.titleIcon && <Icon name={config.titleIcon} />}
            {config.isDone && <Icon name="check-circle" color="green" size="lg" />}
          </Stack>
          {config.stepsDone && config.totalStepsToDo && (
            <Stack direction="row" gap={1}>
              <StepsStatus stepsDone={config.stepsDone} totalStepsToDo={config.totalStepsToDo} />
              complete
            </Stack>
          )}
        </div>
      </Card.Heading>
      <Card.Description className={styles.description}>
        <Stack direction={'column'}>
          {config.description}
          {config.stepsDone && config.totalStepsToDo && (
            <ProgressBar stepsDone={config.stepsDone} totalStepsToDo={config.totalStepsToDo} />
          )}
        </Stack>
      </Card.Description>
      <Card.Actions>
        <Button variant="secondary" onClick={() => handleActionClick(config.id, config.isDone)}>
          {config.actionButtonTitle}
        </Button>
      </Card.Actions>
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  title: css({
    'justify-content': 'flex-start',
    alignItems: 'baseline',
    gap: theme.spacing(0.5),
  }),
  description: css({
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    overflow: 'hidden',
  }),
  essentialsTitle: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  }),
});
