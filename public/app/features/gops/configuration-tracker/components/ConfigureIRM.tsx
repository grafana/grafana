import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { IconName, Text, useStyles2 } from '@grafana/ui';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import {
  GRAFANA_RULES_SOURCE_NAME,
  getFirstCompatibleDataSource,
} from 'app/features/alerting/unified/utils/datasource';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';

import { IRMInteractionNames, trackIrmConfigurationTrackerEvent } from '../Analytics';
import { useGetEssentialsConfiguration } from '../hooks/irmHooks';
import { useGetConfigurationForUI } from '../hooks/useGetConfiguration';

import { ConfigCard } from './ConfigCard';
import { Essentials } from './Essentials';
export interface IrmCardConfiguration {
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

export interface DataSourceConfigurationData {
  dataSourceCompatibleWithAlerting: boolean;
}
function useGetDataSourceConfiguration(): DataSourceConfigurationData {
  return {
    dataSourceCompatibleWithAlerting: Boolean(getFirstCompatibleDataSource()),
  };
}

export function ConfigureIRM() {
  const styles = useStyles2(getStyles);
  const history = useHistory();

  // track only once when the component is mounted
  useEffect(() => {
    trackIrmConfigurationTrackerEvent(IRMInteractionNames.ViewIRMMainPage, {
      essentialStepsDone: 0,
      essentialStepsToDo: 0,
    });
  }, []);

  // get all the configuration data
  const dataSourceConfigurationData = useGetDataSourceConfiguration();
  const essentialsConfigurationData = useGetEssentialsConfiguration();
  const configuration: IrmCardConfiguration[] = useGetConfigurationForUI({
    dataSourceConfigurationData,
    essentialsConfigurationData,
  });

  const [essentialsOpen, setEssentialsOpen] = useState(false);

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
        trackIrmConfigurationTrackerEvent(IRMInteractionNames.OpenEssentials, {
          essentialStepsDone: essentialsConfigurationData.stepsDone,
          essentialStepsToDo: essentialsConfigurationData.totalStepsToDo,
        });
        break;
      default:
        return;
    }
  };

  function onCloseEssentials() {
    setEssentialsOpen(false);
    trackIrmConfigurationTrackerEvent(IRMInteractionNames.CloseEssentials, {
      essentialStepsDone: essentialsConfigurationData.stepsDone,
      essentialStepsToDo: essentialsConfigurationData.totalStepsToDo,
    });
  }

  return (
    <>
      <Text element="h4" variant="h4">
        Configure
      </Text>
      <section className={styles.container}>
        {configuration.map((config) => (
          <ConfigCard key={config.id} config={config} handleActionClick={handleActionClick} />
        ))}
        {essentialsOpen && (
          <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
            <Essentials
              onClose={onCloseEssentials}
              essentialsConfig={essentialsConfigurationData.essentialContent}
              stepsDone={essentialsConfigurationData.stepsDone}
              totalStepsToDo={essentialsConfigurationData.totalStepsToDo}
            />
          </AlertmanagerProvider>
        )}
      </section>
      <Text element="h4" variant="h4">
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
});
