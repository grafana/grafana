import React, { useMemo, useState } from 'react';
import { Button } from '@grafana/ui';
import { cx } from 'emotion';
import AddRemoteInstance from './components/AddRemoteInstance/AddRemoteInstance';
import Discovery from './components/Discovery/Discovery';
import AzureDiscovery from './components/AzureDiscovery/Discovery';
import { AddInstance } from './components/AddInstance/AddInstance';
import { getStyles } from './panel.styles';
import { Messages } from './components/AddRemoteInstance/AddRemoteInstance.messages';
import { InstanceTypes } from './panel.types';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { PAGE_MODEL } from './panel.constants';

const availableInstanceTypes = [
  InstanceTypes.rds,
  InstanceTypes.azure,
  InstanceTypes.postgresql,
  InstanceTypes.mysql,
  InstanceTypes.proxysql,
  InstanceTypes.mongodb,
  InstanceTypes.external,
  InstanceTypes.haproxy,
];

const AddInstancePanel = () => {
  const styles = getStyles();
  const instanceType = '';
  const [selectedInstance, selectInstance] = useState({
    type: availableInstanceTypes.includes(instanceType as InstanceTypes) ? instanceType : '',
  });

  const InstanceForm = useMemo(
    () => () => (
      <>
        {selectedInstance.type !== InstanceTypes.rds && selectedInstance.type !== InstanceTypes.azure && (
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
        {selectedInstance.type === InstanceTypes.rds && <Discovery selectInstance={selectInstance} />}
        {selectedInstance.type === InstanceTypes.azure && <AzureDiscovery selectInstance={selectInstance} />}
        {selectedInstance.type !== InstanceTypes.rds && selectedInstance.type !== InstanceTypes.azure && (
          <AddRemoteInstance instance={selectedInstance} selectInstance={selectInstance} />
        )}
      </>
    ),
    [selectedInstance]
  );

  return (
    <PageWrapper pageModel={PAGE_MODEL}>
      <div className={cx(styles.content, styles.contentPadding)}>
        {!selectedInstance.type ? <AddInstance onSelectInstanceType={selectInstance} /> : <InstanceForm />}
      </div>
    </PageWrapper>
  );
};

export default AddInstancePanel;
