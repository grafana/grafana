import React, { FC, useCallback, useMemo, useState } from 'react';
import { useTheme } from '@grafana/ui';
import { Database } from 'app/percona/shared/components/Elements/Icons/Database';
import { getStyles } from './AddInstance.styles';
import { Messages } from './AddInstance.messages';
import { AddInstanceProps, SelectInstanceProps } from './AddInstance.types';
import { InstanceTypes } from '../../panel.types';
import { Settings } from 'app/percona/settings/Settings.types';
import { CheckPermissions } from 'app/percona/shared/components/Elements/CheckPermissions/CheckPermissions';

export const SelectInstance: FC<SelectInstanceProps> = ({ type, selectInstanceType, title }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <button
      className={styles.navigationButton}
      data-testid={`${type}-instance`}
      onClick={selectInstanceType(type)}
      type="button"
    >
      <Database />
      <span className={styles.addInstanceTitle}>{title}</span>
      <span className={styles.addInstance}>{Messages.titles.addInstance}</span>
    </button>
  );
};

export const AddInstance: FC<AddInstanceProps> = ({ onSelectInstanceType }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [showAzure, setShowAzure] = useState(false);
  const onSettingsLoadSuccess = useCallback((settings: Settings) => {
    setShowAzure(!!settings.azureDiscoverEnabled);
  }, []);
  const instanceList = useMemo(
    () => [
      { type: InstanceTypes.rds, title: Messages.titles.rds },
      { type: InstanceTypes.azure, title: Messages.titles.azure, isHidden: !showAzure },
      { type: InstanceTypes.postgresql, title: Messages.titles.postgresql },
      { type: InstanceTypes.mysql, title: Messages.titles.mysql },
      { type: InstanceTypes.mongodb, title: Messages.titles.mongodb },
      { type: InstanceTypes.proxysql, title: Messages.titles.proxysql },
      { type: InstanceTypes.external, title: Messages.titles.external },
      { type: InstanceTypes.haproxy, title: Messages.titles.haproxy },
    ],
    [showAzure]
  );

  const selectInstanceType = (type: string) => () => onSelectInstanceType({ type });

  return (
    <CheckPermissions onSettingsLoadSuccess={onSettingsLoadSuccess}>
      <section className={styles.content}>
        <nav className={styles.navigationPanel}>
          {instanceList
            .filter(({ isHidden }) => !isHidden)
            .map((item) => (
              <SelectInstance
                selectInstanceType={selectInstanceType}
                type={item.type}
                title={item.title}
                key={item.type}
              />
            ))}
        </nav>
      </section>
    </CheckPermissions>
  );
};
