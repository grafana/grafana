import React, { useMemo, useState } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { cx } from 'emotion';
import AddRemoteInstance from './components/AddRemoteInstance/AddRemoteInstance';
import Discovery from './components/Discovery/Discovery';
import AzureDiscovery from './components/AzureDiscovery/Discovery';
import { AddInstance } from './components/AddInstance/AddInstance';
import { getStyles } from './panel.styles';
import { Messages } from './components/AddRemoteInstance/AddRemoteInstance.messages';
import { InstanceTypesExtra, InstanceAvailable, AvailableTypes } from './panel.types';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { PAGE_MODEL } from './panel.constants';
import { Databases } from '../../percona/shared/core';

const availableInstanceTypes: AvailableTypes[] = [
  InstanceTypesExtra.rds,
  InstanceTypesExtra.azure,
  Databases.postgresql,
  Databases.mysql,
  Databases.proxysql,
  Databases.mongodb,
  InstanceTypesExtra.external,
  Databases.haproxy,
];

const AddInstancePanel = () => {
  const styles = useStyles(getStyles);
  const instanceType = '';
  const [selectedInstance, selectInstance] = useState<InstanceAvailable>({
    type: availableInstanceTypes.includes(instanceType as AvailableTypes) ? instanceType : '',
  });

  const InstanceForm = useMemo(
    () => () => (
      <>
        {selectedInstance.type !== InstanceTypesExtra.rds && selectedInstance.type !== InstanceTypesExtra.azure && (
          <div className={styles.content}>
            <Button
              variant="secondary"
              onClick={() => selectInstance({ type: '' })}
              className={styles.returnButton}
              icon="arrow-left"
            >
              {Messages.form.buttons.toMenu}
            </Button>
          </div>
        )}
        {selectedInstance.type === InstanceTypesExtra.rds && <Discovery selectInstance={selectInstance} />}
        {selectedInstance.type === InstanceTypesExtra.azure && <AzureDiscovery selectInstance={selectInstance} />}
        {selectedInstance.type !== InstanceTypesExtra.rds && selectedInstance.type !== InstanceTypesExtra.azure && (
          <AddRemoteInstance instance={selectedInstance} selectInstance={selectInstance} />
        )}
      </>
    ),
    [selectedInstance]
  );

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <div className={cx(styles.content)}>
        {!selectedInstance.type ? <AddInstance onSelectInstanceType={selectInstance} /> : <InstanceForm />}
      </div>
    </PageWrapper>
  );
};

export default AddInstancePanel;
