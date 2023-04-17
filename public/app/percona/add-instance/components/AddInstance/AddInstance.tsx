import React, { FC, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { useStyles } from '@grafana/ui';
import { Database } from 'app/percona/shared/components/Elements/Icons/Database';
import { Databases } from 'app/percona/shared/core';
import * as UserFlow from 'app/percona/shared/core/reducers/userFlow';
import { useDispatch } from 'app/types';

import { InstanceAvailableType, InstanceTypesExtra } from '../../panel.types';

import { Messages } from './AddInstance.messages';
import { getStyles } from './AddInstance.styles';
import { AddInstanceProps, SelectInstanceProps } from './AddInstance.types';

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

  const dispatch = useDispatch();
  dispatch(UserFlow.startFlow(uuidv4(), 'inventory:add_instance'));

  const selectInstanceType = (type: string) => () => {
    dispatch(
      UserFlow.emitEvent('select_instance_type', {
        type,
      })
    );
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
    onSelectInstanceType({ type: type as InstanceAvailableType });
  };

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
