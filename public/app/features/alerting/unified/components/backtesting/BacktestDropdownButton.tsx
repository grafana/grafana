import { useState } from 'react';

import { TimeRange, dateTime } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Drawer, Dropdown, Menu, MenuItem } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';

import { BacktestPanel } from './BacktestPanel';

interface BacktestDropdownButtonProps {
  ruleDefinition: RuleFormValues;
}

export function BacktestDropdownButton({ ruleDefinition }: BacktestDropdownButtonProps) {
  const [isBacktestPanelOpen, setIsBacktestPanelOpen] = useState(false);
  const [backtestTimeRange, setBacktestTimeRange] = useState<TimeRange | undefined>(undefined);
  const [backtestTriggerRun, setBacktestTriggerRun] = useState<number>(0);

  return (
    <>
      <Dropdown
        overlay={
          <Menu>
            <MenuItem
              label={t('alerting.queryAndExpressionsStep.last15m', 'Last 15 minutes')}
              onClick={() => {
                const timeRange: TimeRange = {
                  from: dateTime().subtract(15, 'minutes'),
                  to: dateTime(),
                  raw: { from: 'now-15m', to: 'now' },
                };
                setBacktestTimeRange(timeRange);
                setIsBacktestPanelOpen(true);
                setBacktestTriggerRun(Date.now());
              }}
            />
            <MenuItem
              label={t('alerting.queryAndExpressionsStep.last1h', 'Last 1 hour')}
              onClick={() => {
                const timeRange: TimeRange = {
                  from: dateTime().subtract(1, 'hour'),
                  to: dateTime(),
                  raw: { from: 'now-1h', to: 'now' },
                };
                setBacktestTimeRange(timeRange);
                setIsBacktestPanelOpen(true);
                setBacktestTriggerRun(Date.now());
              }}
            />
            <MenuItem
              label={t('alerting.queryAndExpressionsStep.custom', 'Custom')}
              onClick={() => {
                setBacktestTimeRange(undefined);
                setIsBacktestPanelOpen(true);
              }}
            />
          </Menu>
        }
      >
        <Button icon="bug" type="button" variant="secondary">
          <Trans i18nKey="alerting.queryAndExpressionsStep.testRule">Test Rule</Trans>
        </Button>
      </Dropdown>

      {isBacktestPanelOpen && (
        <Drawer
          title={t('alerting.backtest.panel-title', 'Rule Retroactive Testing')}
          onClose={() => setIsBacktestPanelOpen(false)}
          size="md"
        >
          <BacktestPanel
            ruleDefinition={ruleDefinition}
            initialTimeRange={backtestTimeRange}
            triggerRun={backtestTriggerRun}
          />
        </Drawer>
      )}
    </>
  );
}
