import { useCallback, useMemo, useState } from 'react';

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
import { isGranted, isLoading, isNotSupported } from '../../hooks/abilities/abilityUtils';
import { useRuleSilenceAbility } from '../../hooks/abilities/rules/rulerRuleAbilities';
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
  const [showSilenceDrawer, setShowSilenceDrawer] = useState(false);

  // Create rule identifier for Grafana managed rules
  const ruleIdentifier: GrafanaRuleIdentifier = useMemo(() => ({ uid: ruleUID, ruleSourceName: 'grafana' }), [ruleUID]);

  const { error, result: rule } = useCombinedRule({ ruleIdentifier });

  const handleSilence = useCallback(() => setShowSilenceDrawer(true), []);
  const handleSilenceClose = useCallback(() => setShowSilenceDrawer(false), []);

  // One Drawer for every state, filled in as the rule arrives. Returning a separate Drawer per
  // state tears this one down and slides a fresh one in, which reads as the drawer flickering.
  return (
    <>
      <Drawer
        onClose={onClose}
        size="md"
        title={<DrawerTitle rule={rule} onSilence={handleSilence} />}
        tabs={
          rule ? (
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
          ) : undefined
        }
      >
        <DrawerContent error={error} rule={rule} activeTab={activeTab} />
      </Drawer>
      {showSilenceDrawer && <SilenceGrafanaRuleDrawer ruleUid={ruleUID} onClose={handleSilenceClose} />}
    </>
  );
}

interface DrawerContentProps {
  error: unknown;
  rule?: CombinedRule;
  activeTab: DrawerTab;
}

function DrawerContent({ error, rule, activeTab }: DrawerContentProps) {
  if (error) {
    return <ErrorContent error={error} />;
  }

  if (!rule) {
    return <div>{t('alerting.common.loading', 'Loading...')}</div>;
  }

  return (
    <TabContent>
      {activeTab === DrawerTab.Query && <QueryAndCondition rule={rule} />}
      {activeTab === DrawerTab.Details && <Details rule={rule} />}
    </TabContent>
  );
}

interface DrawerTitleProps {
  rule?: CombinedRule;
  onSilence: () => void;
}

function DrawerTitle({ rule, onSilence }: DrawerTitleProps) {
  const { rulerRule, promRule } = rule ?? {};
  const isPaused = rulerRuleType.grafana.rule(rulerRule) && isPausedRule(rulerRule);
  const ruleOrigin = getRuleOrigin(rule);

  return (
    <Stack direction="column">
      <Stack direction="row" alignItems="center">
        {rule ? (
          <Title
            name={rule.name}
            paused={isPaused}
            state={prometheusRuleType.alertingRule(promRule) ? promRule.state : undefined}
            health={promRule?.health}
            ruleType={promRule?.type}
            ruleOrigin={ruleOrigin}
          />
        ) : (
          <Text variant="h4" element="h3">
            {t('alerting.triage.rule-details.title', 'Rule Details')}
          </Text>
        )}
        <Spacer />
        {rule && (
          <Stack direction="row" gap={1} alignItems="center">
            <SilenceButton rule={rule} onSilence={onSilence} />
            <Box marginRight={4}>
              <WithReturnButton
                component={
                  <LinkButton
                    icon="external-link-alt"
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
        )}
      </Stack>
      <Text color="secondary">{t('alerting.triage.rule-details.subtitle', 'Rule details and conditions')}</Text>
    </Stack>
  );
}

function getRuleOrigin(rule?: CombinedRule) {
  if (!rule) {
    return undefined;
  }

  return rule.rulerRule ? getRulePluginOrigin(rule.rulerRule) : getRulePluginOrigin(rule.promRule);
}

interface SilenceButtonProps {
  rule: CombinedRule;
  onSilence: () => void;
}

function SilenceButton({ rule, onSilence }: SilenceButtonProps) {
  const ability = useRuleSilenceAbility(rule.rulerRule);

  // Alert instances only go to an external Alertmanager, so there is nothing for us to silence.
  if (isNotSupported(ability)) {
    return null;
  }

  const button = (
    <Button
      icon="bell-slash"
      variant="secondary"
      size="sm"
      disabled={!isGranted(ability)}
      onClick={isGranted(ability) ? onSilence : undefined}
    >
      <Trans i18nKey="alerting.rule-details-drawer.silence-button">Silence</Trans>
    </Button>
  );

  // Still working out the folder permissions - don't claim they're missing yet.
  if (isLoading(ability) || isGranted(ability)) {
    return button;
  }

  return (
    <Tooltip
      content={t(
        'alerting.triage.rule-details-drawer.silence-no-permission',
        'You do not have permission to create silences'
      )}
    >
      {button}
    </Tooltip>
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
