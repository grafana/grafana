import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Icon, IconName, Stack, Text, useStyles2 } from '@grafana/ui';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { fetchAllPromBuildInfoAction } from 'app/features/alerting/unified/state/actions';
import {
  GRAFANA_RULES_SOURCE_NAME,
  getFirstCompatibleDataSource,
} from 'app/features/alerting/unified/utils/datasource';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { useDispatch } from 'app/types';

import {
  trackCloseIrmConfigurationEssentials,
  trackIrmMainPageView,
  trackOpenIrmConfigurationEssentials,
} from '../Analytics';
import { useGetEssentialsConfiguration } from '../hooks/irmHooks';

import { Essentials } from './Essentials';
import { ProgressBar, StepsStatus } from './ProgressBar';
interface DataConfiguration {
  id: number;
  title: string;
  description: string;
  actionButtonTitle: string;
  isDone?: boolean;
  stepsDone?: number;
  totalStepsToDo?: number;
  titleIcon?: IconName;
}

export enum ConfigurationStepsEnum {
  CONNECT_DATASOURCE,
  ESSENTIALS,
}

export function ConfigureIRM() {
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const dispatchReduxAction = useDispatch();
  useEffect(() => {
    dispatchReduxAction(fetchAllPromBuildInfoAction());
  }, [dispatchReduxAction]);
  // track only once when the component is mounted
  useEffect(() => {
    trackIrmMainPageView({ essentialStepsDone: 0, essentialStepsToDo: 0 });
  }, []);
  const dataSourceCompatibleWithAlerting = Boolean(getFirstCompatibleDataSource()); // we need at least one datasource compatible with alerting

  const [essentialsOpen, setEssentialsOpen] = useState(false);

  const {
    essentialContent,
    stepsDone: essentialStepsDone,
    totalStepsToDo: essentialStepsToDo,
  } = useGetEssentialsConfiguration();

  const configuration: DataConfiguration[] = useMemo(() => {
    function getConnectDataSourceConfiguration() {
      const description = dataSourceCompatibleWithAlerting
        ? 'You have connected datasource.'
        : 'Connect at least one data source to start receiving data.';
      const actionButtonTitle = dataSourceCompatibleWithAlerting ? 'View' : 'Connect';
      return {
        id: ConfigurationStepsEnum.CONNECT_DATASOURCE,
        title: 'Connect data source',
        description,
        actionButtonTitle,
        isDone: dataSourceCompatibleWithAlerting,
      };
    }
    return [
      getConnectDataSourceConfiguration(),
      {
        id: ConfigurationStepsEnum.ESSENTIALS,
        title: 'Essentials',
        titleIcon: 'star',
        description: 'Configure the features you need to start using Grafana IRM workflows',
        actionButtonTitle: 'Start',
        stepsDone: essentialStepsDone,
        totalStepsToDo: essentialStepsToDo,
      },
    ];
  }, [dataSourceCompatibleWithAlerting, essentialStepsDone, essentialStepsToDo]);

  const handleActionClick = (configID: number, isDone?: boolean) => {
    switch (configID) {
      case ConfigurationStepsEnum.CONNECT_DATASOURCE:
        if (isDone) {
          history.push(DATASOURCES_ROUTES.List);
        } else {
          history.push(DATASOURCES_ROUTES.New);
        }
        break;
      case ConfigurationStepsEnum.ESSENTIALS:
        setEssentialsOpen(true);
        trackOpenIrmConfigurationEssentials({ essentialStepsDone, essentialStepsToDo });
        break;
      default:
        return;
    }
  };

  function onCloseEssentials() {
    setEssentialsOpen(false);
    trackCloseIrmConfigurationEssentials({ essentialStepsDone, essentialStepsToDo });
  }

  return (
    <>
      <Text element="h4" variant="h4">
        {' '}
        Configure
      </Text>
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
        })}
        {essentialsOpen && (
          <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
            <Essentials
              onClose={onCloseEssentials}
              essentialsConfig={essentialContent}
              stepsDone={essentialStepsDone}
              totalStepsToDo={essentialStepsToDo}
            />
          </AlertmanagerProvider>
        )}
      </section>
      <Text element="h4" variant="h4">
        {' '}
        IRM apps
      </Text>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: 0,
    display: 'grid',
    gap: theme.spacing(3),
    'grid-template-columns': ' 1fr 1fr',
  }),
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
