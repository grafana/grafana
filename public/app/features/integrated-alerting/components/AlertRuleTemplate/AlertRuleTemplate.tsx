import React, { FC, useState, useEffect } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Messages } from 'app/features/integrated-alerting/IntegratedAlerting.messages';
import { getStyles } from './AlertRuleTemplate.styles';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
import { AlertRuleTemplatesTable } from '..';
import { FormattedTemplate } from './AlertRuleTemplatesTable/AlertRuleTemplatesTable.types';
import { formatTemplates } from './AlertRuleTemplatesTable/AlertRuleTemplatesTable.utils';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';

export const AlertRuleTemplate: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [data, setData] = useState<FormattedTemplate[]>([]);

  const getAlertRuleTemplates = async () => {
    setPendingRequest(true);
    try {
      const { templates } = await AlertRuleTemplateService.list();
      setData(formatTemplates(templates));
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  useEffect(() => {
    getAlertRuleTemplates();
  }, []);

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
      <AddAlertRuleTemplateModal
        isVisible={addModalVisible}
        setVisible={setAddModalVisible}
        getAlertRuleTemplates={getAlertRuleTemplates}
      />
      <AlertRuleTemplatesTable
        pendingRequest={pendingRequest}
        data={data}
        getAlertRuleTemplates={getAlertRuleTemplates}
      />
    </>
  );
};
