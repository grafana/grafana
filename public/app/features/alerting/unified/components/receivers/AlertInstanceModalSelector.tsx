import { css, cx } from '@emotion/css';
import React, { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { Button, clearButtonStyles, FilterInput, LoadingPlaceholder, Modal, Tooltip, useStyles2 } from '@grafana/ui';
import { AlertmanagerAlert, TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';
import { dispatch } from 'app/store/store';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchAmAlertsAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';

export function AlertInstanceModalSelector({
  onSelect,
  isOpen,
  onClose,
}: {
  onSelect: (alerts: TestTemplateAlert[]) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const styles = useStyles2(getStyles);

  const [selectedRule, setSelectedRule] = useState<string>();
  const [selectedInstances, setSelectedInstances] = useState<AlertmanagerAlert[] | null>(null);

  const [filteredRules, setFilteredRules] = useState<Record<string, AlertmanagerAlert[]> | null>(null);

  const alertsRequests = useUnifiedAlertingSelector((state) => state.amAlerts);
  const { loading, result, error } = alertsRequests[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState;

  const [ruleFilter, setRuleFilter] = useState('');

  useEffect(() => {
    dispatch(fetchAmAlertsAction(GRAFANA_RULES_SOURCE_NAME));
  }, []);

  const rulesWithInstances: Record<string, AlertmanagerAlert[]> = useMemo(() => {
    return {};
  }, []);

  const handleRuleChange = useCallback((rule: string) => {
    setSelectedRule(rule);
    setSelectedInstances(null);
  }, []);

  useEffect(() => {
    if (!loading && result) {
      result.forEach((instance) => {
        if (!rulesWithInstances[instance.labels['alertname']]) {
          rulesWithInstances[instance.labels['alertname']] = [];
        }
        rulesWithInstances[instance.labels['alertname']].push(instance);
      });
      setFilteredRules(rulesWithInstances);

      console.log(rulesWithInstances);
    }
  }, [loading, result, rulesWithInstances]);

  if (error) {
    return null;
  }

  const RuleRow = ({ index, style }: { index: number; style?: CSSProperties }) => {
    if (!filteredRules) {
      return null;
    }
    const ruleName = Object.keys(filteredRules)[index];

    const isSelected = ruleName === selectedRule;

    return (
      <button
        type="button"
        title={ruleName}
        style={style}
        className={cx(styles.rowButton, { [styles.rowOdd]: index % 2 === 1, [styles.rowSelected]: isSelected })}
        onClick={() => handleRuleChange(ruleName)}
      >
        <div className={cx(styles.ruleTitle, styles.rowButtonTitle)}>{ruleName}</div>
      </button>
    );
  };

  const InstanceRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    if (!selectedRule || !rulesWithInstances[selectedRule].length) {
      return null;
    }

    const alert = rulesWithInstances[selectedRule][index];

    const isSelected = selectedInstances?.includes(alert);

    const handleSelectInstances = () => {
      if (isSelected && selectedInstances) {
        setSelectedInstances(selectedInstances.filter((instance) => instance !== alert));
        return;
      }
      setSelectedInstances([...(selectedInstances || []), alert]);
    };

    return (
      <button
        type="button"
        style={style}
        className={cx(styles.rowButton, styles.instanceButton, {
          [styles.rowOdd]: index % 2 === 1,
          [styles.rowSelected]: isSelected,
        })}
        onClick={handleSelectInstances}
      >
        <div className={styles.rowButtonTitle} title={alert.labels['alertname']}>
          <Tooltip placement="bottom" content={<pre>{JSON.stringify(alert, null, 2)}</pre>} theme={'info'}>
            <span>
              Starts at: {dateTimeFormat(alert.startsAt, { format: 'YYYY-MM-DD HH:mm:ss' })} - Ends at:{' '}
              {dateTimeFormat(alert.startsAt, { format: 'YYYY-MM-DD HH:mm:ss' })}
            </span>
          </Tooltip>
        </div>
      </button>
    );
  };

  const handleConfirm = () => {
    const instances: TestTemplateAlert[] =
      selectedInstances?.map((instance: AlertmanagerAlert) => {
        const alert: TestTemplateAlert = {
          annotations: instance.annotations,
          labels: instance.labels,
          startsAt: instance.startsAt,
          endsAt: instance.endsAt,
        };
        return alert;
      }) || [];

    onSelect(instances);
  };

  const handleSearchRules = (filter: string) => {
    setRuleFilter(filter);
    const filteredRules = Object.keys(rulesWithInstances).filter((rule) =>
      rule.toLowerCase().includes(filter.toLowerCase())
    );
    const filteredRulesObject: Record<string, AlertmanagerAlert[]> = {};
    filteredRules.forEach((rule) => {
      filteredRulesObject[rule] = rulesWithInstances[rule];
    });
    setFilteredRules(filteredRulesObject);
  };

  return (
    <div>
      <Modal
        title="Select alert instances"
        className={styles.modal}
        closeOnEscape
        isOpen={isOpen}
        onDismiss={onClose}
        contentClassName={styles.modalContent}
      >
        <div className={styles.container}>
          <FilterInput
            value={ruleFilter}
            onChange={handleSearchRules}
            title="Search alert rule"
            placeholder="Search alert rule"
            autoFocus
          />
          <div>{(selectedRule && 'Select one or more instances from the list below') || ''}</div>

          <div className={styles.column}>
            {loading && <LoadingPlaceholder text="Loading rules..." className={styles.loadingPlaceholder} />}

            {!loading && (
              <AutoSizer>
                {({ height, width }) => (
                  <FixedSizeList
                    itemSize={50}
                    height={height}
                    width={width}
                    itemCount={Object.keys(filteredRules || {}).length}
                  >
                    {RuleRow}
                  </FixedSizeList>
                )}
              </AutoSizer>
            )}
          </div>

          <div className={styles.column}>
            {!selectedRule && !loading && (
              <div className={styles.selectedRulePlaceholder}>
                <div>Select an alert rule to get a list of available instances</div>
              </div>
            )}
            {loading && <LoadingPlaceholder text="Loading rule..." className={styles.loadingPlaceholder} />}

            {selectedRule && rulesWithInstances[selectedRule].length && !loading && (
              <AutoSizer>
                {({ width, height }) => (
                  <FixedSizeList
                    itemSize={32}
                    height={height}
                    width={width}
                    itemCount={rulesWithInstances[selectedRule].length || 0}
                  >
                    {InstanceRow}
                  </FixedSizeList>
                )}
              </AutoSizer>
            )}
          </div>
        </div>
        <Modal.ButtonRow>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!(selectedRule && selectedInstances)}
            onClick={() => {
              if (selectedRule && selectedInstances) {
                handleConfirm();
              }
            }}
          >
            Confirm
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const clearButton = clearButtonStyles(theme);

  return {
    container: css`
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: min-content auto;
      gap: ${theme.spacing(2)};
      flex: 1;
    `,
    column: css`
      flex: 1 1 auto;
    `,

    alertLabels: css`
      overflow-x: auto;
    `,
    ruleTitle: css`
      height: 22px;
      font-weight: ${theme.typography.fontWeightBold};
    `,
    rowButton: css`
      ${clearButton};
      padding: ${theme.spacing(0.5)};
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
      border: 2px solid transparent;

      &:disabled {
        cursor: not-allowed;
        color: ${theme.colors.text.disabled};
      }
    `,
    rowButtonTitle: css`
      overflow-x: auto;
    `,
    rowSelected: css`
      border-color: ${theme.colors.primary.border};
    `,
    rowOdd: css`
      background-color: ${theme.colors.background.secondary};
    `,
    instanceButton: css`
      display: flex;
      gap: ${theme.spacing(1)};
      justify-content: space-between;
      align-items: center;
    `,
    loadingPlaceholder: css`
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    `,
    selectedRulePlaceholder: css`
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      font-weight: ${theme.typography.fontWeightBold};
    `,
    modal: css`
      height: 100%;
    `,
    modalContent: css`
      flex: 1;
      display: flex;
      flex-direction: column;
    `,
    modalAlert: css`
      flex-grow: 0;
    `,
    warnIcon: css`
      fill: ${theme.colors.warning.main};
    `,
    labels: css`
      justify-content: flex-start;
    `,
  };
};
