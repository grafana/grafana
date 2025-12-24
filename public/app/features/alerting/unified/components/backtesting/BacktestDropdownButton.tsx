import { useCallback, useState } from 'react';

import { TimeRange, rangeUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Drawer, Dropdown, Menu, MenuItem } from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';

import { BacktestPanel } from './BacktestPanel';

interface BacktestDropdownButtonProps {
  ruleDefinition: RuleFormValues;
}

export function BacktestDropdownButton({ ruleDefinition }: BacktestDropdownButtonProps) {
  const [isBacktestPanelOpen, setIsBacktestPanelOpen] = useState(false);
  const [backtestTimeRange, setBacktestTimeRange] = useState<TimeRange>();

  const handleTimeRangeSelect = useCallback((rawFrom: string) => {
    const timeRange = rangeUtil.convertRawToRange({ from: rawFrom, to: 'now' });
    setBacktestTimeRange(timeRange);
    setIsBacktestPanelOpen(true);
  }, []);

  const handleCustomSelect = useCallback(() => {
    setBacktestTimeRange(undefined);
    setIsBacktestPanelOpen(true);
  }, []);

  return (
    <>
      <Dropdown
        overlay={
          <Menu>
            <MenuItem
              label={t('alerting.queryAndExpressionsStep.last15m', 'Last 15 minutes')}
              onClick={() => handleTimeRangeSelect('now-15m')}
            />
            <MenuItem
              label={t('alerting.queryAndExpressionsStep.last1h', 'Last 1 hour')}
              onClick={() => handleTimeRangeSelect('now-1h')}
            />
            <MenuItem
              label={t('alerting.queryAndExpressionsStep.custom', 'Custom')}
              onClick={handleCustomSelect}
            />
          </Menu>
        }
      >
        <Button icon="bug" variant="secondary">
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
          />
        </Drawer>
      )}
    </>
  );
}
