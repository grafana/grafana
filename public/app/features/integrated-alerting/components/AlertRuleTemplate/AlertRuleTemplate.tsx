import React, { FC, useState } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { Messages } from 'app/features/integrated-alerting/IntegratedAlerting.messages';
import { getStyles } from './AlertRuleTemplate.styles';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
import { AlertRuleTemplatesTable } from '..';

export const AlertRuleTemplate: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);

  return (
    <>
      <div className={styles.actionsWrapper}>
        <Button
          size="md"
          icon="plus-square"
          variant="link"
          onClick={() => setAddModalVisible(!addModalVisible)}
          data-qa="alert-rule-template-add-modal-button"
        >
          {Messages.alertRuleTemplate.addAction}
        </Button>
      </div>
      <AddAlertRuleTemplateModal isVisible={addModalVisible} setVisible={setAddModalVisible} />
      <AlertRuleTemplatesTable />
    </>
  );
};
