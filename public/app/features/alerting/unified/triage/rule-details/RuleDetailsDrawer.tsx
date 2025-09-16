import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Drawer, Tab, TabContent, TabsBar } from '@grafana/ui';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { Details } from '../../components/rule-viewer/tabs/Details';
import { QueryResults } from '../../components/rule-viewer/tabs/Query';
import { useCombinedRule } from '../../hooks/useCombinedRule';
import { stringifyErrorLike } from '../../utils/misc';

interface RuleDetailsDrawerProps {
  ruleUID: string;
  onClose: () => void;
}

enum DrawerTab {
  Query = 'query',
  Details = 'details',
}

export function RuleDetailsDrawer({ ruleUID, onClose }: RuleDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(DrawerTab.Query);

  // Create rule identifier for Grafana managed rules
  const ruleIdentifier: GrafanaRuleIdentifier = useMemo(
    () => ({
      uid: ruleUID,
      ruleSourceName: 'grafana',
    }),
    [ruleUID]
  );

  // Fetch rule data
  const {
    loading,
    error,
    result: rule,
  } = useCombinedRule({
    ruleIdentifier,
  });

  if (error) {
    return (
      <Drawer title={t('alerting.triage.rule-details', 'Rule Details')} onClose={onClose} size="lg">
        <ErrorContent error={error} />
      </Drawer>
    );
  }

  if (loading || !rule) {
    return (
      <Drawer title={t('alerting.triage.rule-details', 'Rule Details')} onClose={onClose} size="lg">
        <div>{t('alerting.common.loading', 'Loading...')}</div>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={rule.name}
      subtitle={t('alerting.triage.rule-details.subtitle', 'Rule details and conditions')}
      onClose={onClose}
      size="md"
      tabs={
        <TabsBar>
          <Tab
            label={t('alerting.rule-viewer.tab.query-conditions', 'Query and conditions')}
            active={activeTab === DrawerTab.Query}
            onChangeTab={() => setActiveTab(DrawerTab.Query)}
          />
          <Tab
            label={t('alerting.rule-viewer.tab.details', 'Details')}
            active={activeTab === DrawerTab.Details}
            onChangeTab={() => setActiveTab(DrawerTab.Details)}
          />
        </TabsBar>
      }
    >
      <TabContent>
        {activeTab === DrawerTab.Query && <QueryResults rule={rule} />}
        {activeTab === DrawerTab.Details && <Details rule={rule} />}
      </TabContent>
    </Drawer>
  );
}

interface ErrorContentProps {
  error: unknown;
}

function ErrorContent({ error }: ErrorContentProps) {
  if (isFetchError(error) && error.status === 404) {
    return (
      <Alert title={t('alerting.triage.rule-not-found', 'Rule not found')} severity="error">
        {t('alerting.triage.rule-not-found.description', 'The requested rule could not be found.')}
      </Alert>
    );
  }

  return (
    <Alert title={t('alerting.triage.error-loading-rule', 'Error loading rule')} severity="error">
      {stringifyErrorLike(error)}
    </Alert>
  );
}
