import React, { FC, useState, useEffect } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Messages } from 'app/features/integrated-alerting/IntegratedAlerting.messages';
import { getStyles } from './AlertRuleTemplate.styles';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
import { Table } from '../Table/Table';
import { formatTemplates } from './AlertRuleTemplate.utils';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';
import { Column } from 'react-table';
import { AlertRuleTemplateActions } from './AlertRuleTemplateActions/AlertRuleTemplateActions';
import { FormattedTemplate } from './AlertRuleTemplate.types';

const { noData, columns } = Messages.alertRuleTemplate.table;

const { name: nameColumn, source: sourceColumn, createdAt: createdAtColumn, actions: actionsColumn } = columns;

export const AlertRuleTemplate: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(true);
  const [data, setData] = useState<FormattedTemplate[]>([]);

  const columns = React.useMemo(
    () => [
      {
        Header: nameColumn,
        accessor: 'summary',
        width: '70%',
      } as Column,
      {
        Header: sourceColumn,
        accessor: 'source',
        width: '20%',
      } as Column,
      {
        Header: createdAtColumn,
        accessor: 'created_at',
        width: '10%',
      } as Column,
      {
        Header: actionsColumn,
        accessor: (template: FormattedTemplate) => (
          <AlertRuleTemplateActions template={template} getAlertRuleTemplates={getAlertRuleTemplates} />
        ),
      } as Column,
    ],
    []
  );

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
      <Table data={data} columns={columns} pendingRequest={pendingRequest} emptyMessage={noData} />
    </>
  );
};
