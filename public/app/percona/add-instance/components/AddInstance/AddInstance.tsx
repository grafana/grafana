import React, { FC } from 'react';
import { useTheme } from '@grafana/ui';
import { Database } from 'app/percona/shared/components/Elements/Icons/Database';
import { getStyles } from './AddInstance.styles';
import { instanceList } from './AddInstance.constants';
import { Messages } from './AddInstance.messages';
import { AddInstanceProps, SelectInstanceProps } from './AddInstance.types';

export const SelectInstance: FC<SelectInstanceProps> = ({ type, selectInstanceType, title }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <button
      className={styles.navigationButton}
      data-qa={`${type}-instance`}
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

  const selectInstanceType = (type: string) => () => onSelectInstanceType({ type });

  return (
    <section className={styles.content}>
      <nav className={styles.navigationPanel}>
        {instanceList.map(item => (
          <SelectInstance selectInstanceType={selectInstanceType} type={item.type} title={item.title} key={item.type} />
        ))}
      </nav>
    </section>
  );
};
