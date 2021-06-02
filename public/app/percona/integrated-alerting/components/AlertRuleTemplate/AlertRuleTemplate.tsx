/* eslint-disable react/display-name */
import { logger } from '@percona/platform-core';
import React, { useCallback, useEffect, useState } from 'react';
import { Column } from 'react-table';

import { Button, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/integrated-alerting/IntegratedAlerting.messages';

import { useStoredTablePageSize } from '../Table/Pagination';
import { Table } from '../Table/Table';

import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
import { ALERT_RULE_TEMPLATES_TABLE_ID } from './AlertRuleTemplate.constants';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';
import { getStyles } from './AlertRuleTemplate.styles';
import { FormattedTemplate } from './AlertRuleTemplate.types';
import { formatTemplates } from './AlertRuleTemplate.utils';
import { AlertRuleTemplateActions } from './AlertRuleTemplateActions/AlertRuleTemplateActions';

const { noData, columns } = Messages.alertRuleTemplate.table;

const { name: nameColumn, source: sourceColumn, createdAt: createdAtColumn, actions: actionsColumn } = columns;

export const AlertRuleTemplate: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(true);
  const [data, setData] = useState<FormattedTemplate[]>([]);
  const [pageSize, setPageSize] = useStoredTablePageSize(ALERT_RULE_TEMPLATES_TABLE_ID);
  const [pageIndex, setPageindex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const getAlertRuleTemplates = useCallback(async () => {
    setPendingRequest(true);
    try {
      const { templates, totals } = await AlertRuleTemplateService.list({
        page_params: {
          index: pageIndex,
          page_size: pageSize as number,
        },
      });
      setData(formatTemplates(templates));
      setTotalItems(totals.total_items || 0);
      setTotalPages(totals.total_pages || 0);
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  }, [pageIndex, pageSize]);

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
    [getAlertRuleTemplates]
  );

  const handlePaginationChanged = useCallback(
    (pageSize: number, pageIndex: number) => {
      setPageSize(pageSize);
      setPageindex(pageIndex);
    },
    [setPageSize, setPageindex]
  );

  useEffect(() => {
    getAlertRuleTemplates();
  }, [pageSize, pageIndex, getAlertRuleTemplates]);

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
      <Table
        showPagination
        totalItems={totalItems}
        totalPages={totalPages}
        pageSize={pageSize}
        pageIndex={pageIndex}
        onPaginationChanged={handlePaginationChanged}
        data={data}
        columns={columns}
        pendingRequest={pendingRequest}
        emptyMessage={noData}
      />
    </>
  );
};
