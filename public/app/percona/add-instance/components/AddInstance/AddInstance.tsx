import React, { FC, useMemo } from 'react';
import { useStyles } from '@grafana/ui';
import { Database } from 'app/percona/shared/components/Elements/Icons/Database';
import { Databases } from 'app/percona/shared/core';
import { getStyles } from './AddInstance.styles';
import { Messages } from './AddInstance.messages';
import { AddInstanceProps, SelectInstanceProps } from './AddInstance.types';
import { InstanceTypesExtra, InstanceAvailableType } from '../../panel.types';

export const SelectInstance: FC<SelectInstanceProps> = ({ type, selectInstanceType, title }) => {
  const styles = useStyles(getStyles);

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

export const AddInstance: FC<AddInstanceProps> = ({ onSelectInstanceType, showAzure }) => {
  const styles = useStyles(getStyles);
  const instanceList = useMemo(
    () => [
      { type: InstanceTypesExtra.rds, title: Messages.titles.rds },
      { type: InstanceTypesExtra.azure, title: Messages.titles.azure, isHidden: !showAzure },
      { type: Databases.postgresql, title: Messages.titles.postgresql },
      { type: Databases.mysql, title: Messages.titles.mysql },
      { type: Databases.mongodb, title: Messages.titles.mongodb },
      { type: Databases.proxysql, title: Messages.titles.proxysql },
      { type: InstanceTypesExtra.external, title: Messages.titles.external },
      { type: Databases.haproxy, title: Messages.titles.haproxy },
    ],
    [showAzure]
  );

  const selectInstanceType = (type: string) => () => onSelectInstanceType({ type: type as InstanceAvailableType });

  return (
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
  );
};
