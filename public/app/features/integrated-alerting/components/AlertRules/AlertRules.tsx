import React, { FC, useCallback, useEffect, useState } from 'react';
import { Column } from 'react-table';
import { Button, useStyles, IconButton } from '@grafana/ui';
import { logger } from '@percona/platform-core';
import { Table } from '../Table/Table';
import { AddAlertRuleModal } from './AddAlertRuleModal';
import { getStyles } from './AlertRules.styles';
import { AlertRulesProvider } from './AlertRules.provider';
import { AlertRulesService } from './AlertRules.service';
import { Messages } from '../../IntegratedAlerting.messages';
import { formatRules } from './AlertRules.utils';
import { AlertRule } from './AlertRules.types';
import { AlertRulesActions } from './AlertRulesActions';
import { ALERT_RULES_TABLE_ID } from './AlertRules.constants';
import { useStoredTablePageSize } from '../Table/Pagination';

const { noData, columns } = Messages.alertRules.table;

const {
  createdAt: createdAtColumn,
  duration: durationColumn,
  filters: filtersColumn,
  severity: severityColumn,
  summary: summaryColumn,
  threshold: thresholdColumn,
  actions: actionsColumn,
} = columns;

export const AlertRules: FC = () => {
  const styles = useStyles(getStyles);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(true);
  const [selectedAlertRule, setSelectedAlertRule] = useState<AlertRule | null>();
  const [selectedRuleDetails, setSelectedRuleDetails] = useState<AlertRule | null>();
  const [data, setData] = useState<AlertRule[]>([]);
  const [pageSize, setPageSize] = useStoredTablePageSize(ALERT_RULES_TABLE_ID);
  const [pageIndex, setPageindex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const getAlertRules = async () => {
    setPendingRequest(true);
    try {
      const { rules = [], totals } = await AlertRulesService.list({
        page_params: {
          index: pageIndex,
          page_size: pageSize as number,
        },
      });
      setData(formatRules(rules));
      setTotalItems(totals.total_items || 0);
      setTotalPages(totals.total_pages || 0);
    } catch (e) {
      logger.error(e);
    } finally {
      setPendingRequest(false);
    }
  };

  const columns = React.useMemo(
    () => [
      {
        Header: summaryColumn,
        accessor: (alertRule: AlertRule) => (
          <div className={styles.nameWrapper}>
            {alertRule.summary}
            {selectedRuleDetails && selectedRuleDetails.ruleId === alertRule.ruleId ? (
              <IconButton
                data-qa="hide-alert-rule-details"
                name="arrow-up"
                onClick={() => setSelectedRuleDetails(null)}
              />
            ) : (
              <IconButton
                data-qa="show-alert-rule-details"
                name="arrow-down"
                onClick={() => setSelectedRuleDetails(alertRule)}
                disabled={alertRule.disabled}
              />
            )}
          </div>
        ),
        width: '25%',
      } as Column,
      {
        Header: thresholdColumn,
        accessor: 'threshold',
        width: '10%',
      } as Column,
      {
        Header: durationColumn,
        accessor: 'duration',
        width: '10%',
      } as Column,
      {
        Header: severityColumn,
        accessor: 'severity',
        width: '5%',
      } as Column,
      {
        Header: filtersColumn,
        accessor: ({ filters }: AlertRule) => (
          <div className={styles.filtersWrapper}>
            {filters.map(filter => (
              <span key={filter} className={styles.filter}>
                {filter}
              </span>
            ))}
          </div>
        ),
        width: '35%',
      } as Column,
      {
        Header: createdAtColumn,
        accessor: 'createdAt',
        width: '10%',
      } as Column,
      {
        Header: actionsColumn,
        width: '5%',
        accessor: (alertRule: AlertRule) => <AlertRulesActions alertRule={alertRule} />,
      } as Column,
    ],
    [selectedRuleDetails]
  );

  const onPaginationChanged = useCallback((pageSize: number, pageIndex: number) => {
    setPageSize(pageSize);
    setPageindex(pageIndex);
  }, []);

  const handleAddButton = () => {
    setSelectedAlertRule(null);
    setAddModalVisible(currentValue => !currentValue);
  };

  useEffect(() => {
    getAlertRules();
  }, [pageSize, pageIndex]);

  return (
    <AlertRulesProvider.Provider
      value={{ getAlertRules, setAddModalVisible, setSelectedAlertRule, setSelectedRuleDetails, selectedRuleDetails }}
    >
      <div className={styles.actionsWrapper}>
        <Button
          size="md"
          icon="plus-square"
          variant="link"
          onClick={handleAddButton}
          data-qa="alert-rule-template-add-modal-button"
        >
          {Messages.alertRuleTemplate.addAction}
        </Button>
      </div>
      <AddAlertRuleModal isVisible={addModalVisible} setVisible={setAddModalVisible} alertRule={selectedAlertRule} />
      <Table
        showPagination
        totalItems={totalItems}
        totalPages={totalPages}
        pageSize={pageSize as number}
        pageIndex={pageIndex}
        onPaginationChanged={onPaginationChanged}
        data={data}
        columns={columns}
        pendingRequest={pendingRequest}
        emptyMessage={noData}
      >
        {(rows, table) =>
          rows.map(row => {
            const { prepareRow } = table;
            prepareRow(row);
            const alertRule = row.original as AlertRule;

            return (
              <React.Fragment key={alertRule.ruleId}>
                <tr {...row.getRowProps()} className={alertRule.disabled ? styles.disabledRow : ''}>
                  {row.cells.map(cell => (
                    <td {...cell.getCellProps()} key={cell.column.id}>
                      {cell.render('Cell')}
                    </td>
                  ))}
                </tr>
                {selectedRuleDetails && alertRule.ruleId === selectedRuleDetails.ruleId && (
                  <tr key={selectedRuleDetails.ruleId}>
                    <td colSpan={columns.length}>
                      <pre data-qa="alert-rules-details" className={styles.details}>
                        {alertRule.expr}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })
        }
      </Table>
    </AlertRulesProvider.Provider>
  );
};
