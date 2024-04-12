import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Icon, IconName, Stack, Text, useStyles2 } from '@grafana/ui';
import { useRulesSourcesWithRuler } from 'app/features/alerting/unified/hooks/useRuleSourcesWithRuler';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { fetchAllPromBuildInfoAction } from 'app/features/alerting/unified/state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { useDispatch } from 'app/types';

import { useGetEssentialsConfiguration } from '../hooks/irmHooks';

import { Essentials } from './Essentials';
interface DataConfiguration {
  id: number;
  title: string;
  description: string;
  text: string;
  actionButtonTitle: string;
  isDone?: boolean;
  stepsDone?: number;
  totalStepsToDo?: number;
  titleIcon?: IconName;
}

export function ConfigureIRM() {
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const dispatchReduxAction = useDispatch();
  useEffect(() => {
    dispatchReduxAction(fetchAllPromBuildInfoAction());
  }, [dispatchReduxAction]);
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const { essentialContent, stepsDone, totalStepsToDo } = useGetEssentialsConfiguration();
  const configuration: DataConfiguration[] = useMemo(() => {
    return [
      {
        id: 1,
        title: 'Connect datasource to recieve data',
        description: 'Before your start configuration you need to connect at least one datasource.',
        text: 'Configure IRM',
        actionButtonTitle: 'Connect',
        isDone: rulesSourcesWithRuler.length > 0,
      },
      {
        id: 2,
        title: 'Essentials',
        titleIcon: 'star',
        description: 'Complete the basic configuration to start using the apps',
        text: 'Configure IRM',
        actionButtonTitle: 'View tasks',
        stepsDone: stepsDone,
        totalStepsToDo: totalStepsToDo,
      },
    ];
  }, [rulesSourcesWithRuler, stepsDone, totalStepsToDo]);

  const handleActionClick = (configID: number) => {
    switch (configID) {
      case 1:
        history.push(DATASOURCES_ROUTES.New);
        break;
      case 2:
        setEssentialsOpen(true);
        break;
      default:
        return;
    }
  };

  return (
    <section className={styles.container}>
      {configuration.map((config) => {
        return (
          <Card key={config.id}>
            <Card.Heading className={styles.title}>
              <div className={styles.essentialsTitle}>
                <Stack direction={'row'} gap={1}>
                  {config.title}
                  {config.titleIcon && <Icon name={config.titleIcon} />}
                  {config.isDone && <Icon name="check-circle" color="green" size="lg" />}
                </Stack>
                {config.stepsDone && config.totalStepsToDo && (
                  <StepsStatus stepsDone={config.stepsDone} totalStepsToDo={config.totalStepsToDo} />
                )}
              </div>
            </Card.Heading>
            {!config.isDone && (
              <>
                <Card.Description className={styles.description}>
                  <Stack direction={'column'}>
                    {config.description}
                    {config.stepsDone && config.totalStepsToDo && (
                      <ProgressBar stepsDone={config.stepsDone} totalStepsToDo={config.totalStepsToDo} />
                    )}
                  </Stack>
                </Card.Description>
                <Card.Actions>
                  <Button variant="secondary" className={styles.actions} onClick={() => handleActionClick(config.id)}>
                    {config.actionButtonTitle}
                  </Button>
                </Card.Actions>
              </>
            )}
          </Card>
        );
      })}
      {essentialsOpen && (
        <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
          <Essentials
            onClose={() => setEssentialsOpen(false)}
            essentialsConfig={essentialContent}
            stepsDone={stepsDone}
            totalStepsToDo={totalStepsToDo}
          />
        </AlertmanagerProvider>
      )}
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: 0,
    display: 'grid',
    gap: '24px',
    'grid-template-columns': ' 1fr 1fr',
  }),
  title: css({
    'justify-content': 'flex-start',
    gap: '4px',
  }),
  description: css({
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    overflow: 'hidden',
  }),
  actions: css({
    marginTop: '24px',
  }),
  essentialsTitle: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  }),
  progressBar: css({
    width: '100%',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.success.text,
    height: theme.spacing(2),
  }),
  containerStyles: css({
    height: theme.spacing(2),
    borderRadius: theme.shape.borderRadius(8),
    backgroundColor: theme.colors.border.weak,
    border: `1px solid ${theme.colors.border.strong}`,
    flex: 'auto',
  }),
  fillerStyles: (stepsDone: number) =>
    css({
      height: '100%',
      width: `${stepsDone}%`,
      backgroundColor: theme.colors.success.main,
      borderRadius: theme.shape.borderRadius(8),
      textAlign: 'right',
    }),
});

export function ProgressBar({ stepsDone, totalStepsToDo }: { stepsDone: number; totalStepsToDo: number }) {
  const styles = useStyles2(getStyles);
  if (totalStepsToDo === 0) {
    return null;
  }
  return (
    <div className={styles.containerStyles}>
      <div className={styles.fillerStyles((stepsDone / totalStepsToDo) * 100)} />
    </div>
  );
}
export function StepsStatus({ stepsDone, totalStepsToDo }: { stepsDone: number; totalStepsToDo: number }) {
  return (
    <div>
      <Text color="success">{stepsDone}</Text> of {totalStepsToDo} complete
    </div>
  );
}
