import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Box, Drawer, LinkButton, Stack, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { Spacer } from '../../components/Spacer';
import { WithReturnButton } from '../../components/WithReturnButton';
import { Title } from '../../components/rule-viewer/RuleViewer';
import { Details } from '../../components/rule-viewer/tabs/Details';
import { QueryResults } from '../../components/rule-viewer/tabs/Query';
import { useCombinedRule } from '../../hooks/useCombinedRule';
import { stringifyErrorLike } from '../../utils/misc';
import { rulesNav } from '../../utils/navigation';
import { getRulePluginOrigin, isPausedRule, prometheusRuleType, rulerRuleType } from '../../utils/rules';

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
      <Drawer title={t('alerting.triage.rule-details.title', 'Rule Details')} onClose={onClose} size="lg">
        <ErrorContent error={error} />
      </Drawer>
    );
  }

  if (loading || !rule) {
    return (
      <Drawer title={t('alerting.triage.rule-details.title', 'Rule Details')} onClose={onClose} size="lg">
        <div>{t('alerting.common.loading', 'Loading...')}</div>
      </Drawer>
    );
  }

  const { rulerRule, promRule } = rule;
  const isPaused = rulerRuleType.grafana.rule(rulerRule) && isPausedRule(rulerRule);
  const ruleOrigin = rulerRule ? getRulePluginOrigin(rulerRule) : getRulePluginOrigin(promRule);

  return (
    <Drawer
      onClose={onClose}
      subtitle={`HELLO`}
      title={
        <Stack direction="column">
          <Stack direction="row" alignItems="center">
            <Title
              name={rule.name}
              paused={isPaused}
              state={prometheusRuleType.alertingRule(promRule) ? promRule.state : undefined}
              health={promRule?.health}
              ruleType={promRule?.type}
              ruleOrigin={ruleOrigin}
            />
            <Spacer />
            <Box marginRight={4}>
              <WithReturnButton
                component={
                  <LinkButton
                    icon="eye"
                    variant="secondary"
                    href={rulesNav.detailsPageLink('grafana', {
                      ruleSourceName: 'grafana',
                      uid: rule.uid ?? '',
                    })}
                    target="_blank"
                    size="sm"
                  >
                    <Trans i18nKey="alerting.rule-details-drawer.go-to-detail-view">View alert rule</Trans>
                  </LinkButton>
                }
              />
            </Box>
          </Stack>
          <Text color="secondary">{t('alerting.triage.rule-details.subtitle', 'Rule details and conditions')}</Text>
        </Stack>
      }
      size="lg"
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
      <Alert title={t('alerting.triage.rule-not-found.title', 'Rule not found')} severity="error">
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
