import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { IconName, Text, useStyles2 } from '@grafana/ui';
import { useURLSearchParams } from 'app/features/alerting/unified/hooks/useURLSearchParams';
import { getFirstCompatibleDataSource } from 'app/features/alerting/unified/utils/datasource';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';

import { IRMInteractionNames, trackIrmConfigurationTrackerEvent } from '../Analytics';
import { useGetConfigurationForUI, useGetEssentialsConfiguration } from '../irmHooks';

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
  const navigate = useNavigate();

  // get all the configuration data
  const dataSourceConfigurationData = useGetDataSourceConfiguration();
  const essentialsConfigurationData = useGetEssentialsConfiguration();
  const configuration: IrmCardConfiguration[] = useGetConfigurationForUI({
    dataSourceConfigurationData,
    essentialsConfigurationData,
  });

  // track only once when the component is mounted
  useEffect(() => {
    trackIrmConfigurationTrackerEvent(IRMInteractionNames.ViewIRMMainPage, {
      essentialStepsDone: 0,
      essentialStepsToDo: 0,
      dataSourceCompatibleWithAlerting: dataSourceConfigurationData.dataSourceCompatibleWithAlerting,
    });
  }, [dataSourceConfigurationData.dataSourceCompatibleWithAlerting]);

  // query param 'essentials' is used to open essentials drawer
  const [queryParams, setQueryParams] = useURLSearchParams();
  const essentialsOpen = queryParams.get('essentials') === 'open';

  const handleActionClick = (configID: number, isDone?: boolean) => {
    trackIrmConfigurationTrackerEvent(IRMInteractionNames.ClickDataSources, {
      essentialStepsDone: essentialsConfigurationData.stepsDone,
      essentialStepsToDo: essentialsConfigurationData.totalStepsToDo,
      dataSourceCompatibleWithAlerting: dataSourceConfigurationData.dataSourceCompatibleWithAlerting,
    });
    switch (configID) {
      case ConfigurationStepsEnum.CONNECT_DATASOURCE:
        if (isDone) {
          navigate(DATASOURCES_ROUTES.List);
        } else {
          navigate(DATASOURCES_ROUTES.New);
        }
        break;
      case ConfigurationStepsEnum.ESSENTIALS:
        setQueryParams({ essentials: 'open' });
        trackIrmConfigurationTrackerEvent(IRMInteractionNames.OpenEssentials, {
          essentialStepsDone: essentialsConfigurationData.stepsDone,
          essentialStepsToDo: essentialsConfigurationData.totalStepsToDo,
          dataSourceCompatibleWithAlerting: dataSourceConfigurationData.dataSourceCompatibleWithAlerting,
        });
        break;
      default:
        return;
    }
  };

  function onCloseEssentials() {
    setQueryParams({ essentials: undefined });
    trackIrmConfigurationTrackerEvent(IRMInteractionNames.CloseEssentials, {
      essentialStepsDone: essentialsConfigurationData.stepsDone,
      essentialStepsToDo: essentialsConfigurationData.totalStepsToDo,
      dataSourceCompatibleWithAlerting: dataSourceConfigurationData.dataSourceCompatibleWithAlerting,
    });
  }

  return (
    <>
      <Text element="h4" variant="h4">
        <Trans i18nKey="gops.configure-irm.configure">Configure</Trans>
      </Text>
      <section className={styles.container}>
        {configuration.map((config) => (
          <ConfigCard
            key={config.id}
            config={config}
            handleActionClick={handleActionClick}
            isLoading={essentialsConfigurationData.isLoading}
          />
        ))}
        {essentialsOpen && (
          <Essentials
            onClose={onCloseEssentials}
            essentialsConfig={essentialsConfigurationData.essentialContent}
            stepsDone={essentialsConfigurationData.stepsDone}
            totalStepsToDo={essentialsConfigurationData.totalStepsToDo}
          />
        )}
      </section>
      <Text element="h4" variant="h4">
        <Trans i18nKey="gops.configure-irm.irm-apps">IRM apps</Trans>
      </Text>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: 0,
    display: 'grid',
    gap: theme.spacing(3),
    gridTemplateColumns: ' 1fr 1fr',
  }),
});
