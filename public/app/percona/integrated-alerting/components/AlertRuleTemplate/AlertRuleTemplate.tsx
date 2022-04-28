/* eslint-disable react/display-name */
import React, { FC, useState, useEffect, useCallback } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import Page from 'app/core/components/Page/Page';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { TechnicalPreview } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { Messages } from 'app/percona/integrated-alerting/IntegratedAlerting.messages';
import { getStyles } from './AlertRuleTemplate.styles';
import { AddAlertRuleTemplateModal } from './AddAlertRuleTemplateModal';
import { Table } from '../Table/Table';
import { formatSource, formatTemplates } from './AlertRuleTemplate.utils';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';
import { Column } from 'react-table';
import { AlertRuleTemplateActions } from './AlertRuleTemplateActions/AlertRuleTemplateActions';
import { FormattedTemplate } from './AlertRuleTemplate.types';
import { ALERT_RULE_TEMPLATES_TABLE_ID, GET_TEMPLATES_CANCEL_TOKEN } from './AlertRuleTemplate.constants';
import { useStoredTablePageSize } from '../Table/Pagination';

const { noData, columns } = Messages.alertRuleTemplate.table;

const { name: nameColumn, source: sourceColumn, createdAt: createdAtColumn, actions: actionsColumn } = columns;

export const AlertRuleTemplate: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(true);
  const navModel = usePerconaNavModel('integrated-alerting-templates');
  const [data, setData] = useState<FormattedTemplate[]>([]);
  const [pageSize, setPageSize] = useStoredTablePageSize(ALERT_RULE_TEMPLATES_TABLE_ID);
  const [pageIndex, setPageindex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [generateToken] = useCancelToken();

  const getAlertRuleTemplates = useCallback(async () => {
    setPendingRequest(true);
    try {
      const { templates, totals } = await AlertRuleTemplateService.list(
        {
          page_params: {
            index: pageIndex,
            page_size: pageSize as number,
          },
        },
        generateToken(GET_TEMPLATES_CANCEL_TOKEN)
      );
      setData(formatTemplates(templates));
      setTotalItems(totals.total_items || 0);
      setTotalPages(totals.total_pages || 0);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPendingRequest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, pageSize]);

  const columns = React.useMemo(
    (): Array<Column<FormattedTemplate>> => [
      {
        Header: nameColumn,
        accessor: 'summary',
        width: '70%',
      },
      {
        Header: sourceColumn,
        accessor: 'source',
        width: '20%',
        Cell: ({ value }) => formatSource(value),
      },
      {
        Header: createdAtColumn,
        accessor: 'created_at',
        width: '10%',
      },
      {
        Header: actionsColumn,
        accessor: (template: FormattedTemplate) => (
          <AlertRuleTemplateActions template={template} getAlertRuleTemplates={getAlertRuleTemplates} />
        ),
      },
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('alertingEnabled'), []);

  useEffect(() => {
    getAlertRuleTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, pageIndex]);

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <TechnicalPreview />
        <FeatureLoader featureName={Messages.integratedAlerting} featureSelector={featureSelector}>
          <div className={styles.actionsWrapper}>
            <Button
              size="md"
              icon="plus-square"
              variant="link"
              onClick={() => setAddModalVisible(!addModalVisible)}
              data-testid="alert-rule-template-add-modal-button"
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
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default AlertRuleTemplate;
