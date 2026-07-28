import { useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Box, Button, Drawer, LinkButton, Stack, Tab, TabContent, TabsBar, Text, Tooltip } from '@grafana/ui';
import { type CombinedRule, type GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { Spacer } from '../../components/Spacer';
import { WithReturnButton } from '../../components/WithReturnButton';
import { Details } from '../../components/rule-viewer/Details';
import { Title } from '../../components/rule-viewer/RuleViewer';
import { QueryAndCondition } from '../../components/rule-viewer/tabs/QueryAndCondition';
import SilenceGrafanaRuleDrawer from '../../components/silences/SilenceGrafanaRuleDrawer';
import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
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
      <Drawer title={t('alerting.triage.rule-details.title', 'Rule Details')} onClose={onClose} size="md">
        <ErrorContent error={error} />
      </Drawer>
    );
  }

  if (loading || !rule) {
    return (
      <Drawer title={t('alerting.triage.rule-details.title', 'Rule Details')} onClose={onClose} size="md">
        <div>{t('alerting.common.loading', 'Loading...')}</div>
      </Drawer>
    );
  }

  return <LoadedRuleDetailsDrawer rule={rule} ruleUID={ruleUID} onClose={onClose} />;
}

interface LoadedRuleDetailsDrawerProps {
  rule: CombinedRule;
  ruleUID: string;
  onClose: () => void;
}

function LoadedRuleDetailsDrawer({ rule, ruleUID, onClose }: LoadedRuleDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>(DrawerTab.Query);
  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);
  const [silenceSupported, silenceAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Silence);

  const { rulerRule, promRule } = rule;
  const isPaused = rulerRuleType.grafana.rule(rulerRule) && isPausedRule(rulerRule);
  const ruleOrigin = rulerRule ? getRulePluginOrigin(rulerRule) : getRulePluginOrigin(promRule);

  return (
    <>
      <Drawer
        onClose={onClose}
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
              <Stack direction="row" gap={1} alignItems="center">
                {silenceSupported &&
                  (silenceAllowed ? (
                    <Button icon="bell-slash" variant="secondary" size="sm" onClick={() => setShowSilenceDrawer(true)}>
                      <Trans i18nKey="alerting.rule-details-drawer.silence-button">Silence</Trans>
                    </Button>
                  ) : (
                    <Tooltip
                      content={t(
                        'alerting.triage.instance-details-drawer.silence-no-permission',
                        'You do not have permission to create silences'
                      )}
                    >
                      <Button icon="bell-slash" variant="secondary" size="sm" disabled>
                        <Trans i18nKey="alerting.rule-details-drawer.silence-button">Silence</Trans>
                      </Button>
                    </Tooltip>
                  ))}
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
            </Stack>
            <Text color="secondary">{t('alerting.triage.rule-details.subtitle', 'Rule details and conditions')}</Text>
          </Stack>
        }
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
          {activeTab === DrawerTab.Query && <QueryAndCondition rule={rule} />}
          {activeTab === DrawerTab.Details && <Details rule={rule} />}
        </TabContent>
      </Drawer>
      {silenceSupported && showSilenceDrawer && (
        <SilenceGrafanaRuleDrawer ruleUid={ruleUID} onClose={() => setShowSilenceDrawer(false)} />
      )}
    </>
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
