import { isEmpty } from 'lodash';

import { NavModelItem } from '@grafana/data';
import { Alert, Stack, Text } from '@grafana/ui';
import { PageInfoItem } from 'app/core/components/Page/types';
import { RuleIdentifier, RuleWithLocation } from 'app/types/unified-alerting';

import { AlertWarning } from '../AlertWarning';
import { AlertLabels } from '../components/AlertLabels';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import InfoPausedRule from '../components/InfoPausedRule';
import { stringifyPendingPeriod } from '../components/rule-editor/PendingPeriodQuickPick';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { FederatedRuleWarning } from '../components/rule-viewer/FederatedRuleWarning';
import { Title } from '../components/rule-viewer/RuleViewer';
import { useRuleWithLocation } from '../hooks/useCombinedRule';
import { useIsRuleEditable } from '../hooks/useIsRuleEditable';
import { Annotation } from '../utils/constants';
import { createViewLinkFromRuleWithLocation, stringifyErrorLike } from '../utils/misc';
import * as ruleId from '../utils/rule-id';
import {
  getAnnotations,
  getPendingPeriodFromRulerRule,
  getRuleName,
  getRulePluginOrigin,
  isFederatedRuleGroup,
  isGrafanaRecordingRule,
  isGrafanaRulerRule,
  isGrafanaRulerRulePaused,
} from '../utils/rules';

import { defaultPageNav } from './RuleEditor';

interface ExistingRuleEditorProps {
  identifier: RuleIdentifier;
}

export function ExistingRuleEditor({ identifier }: ExistingRuleEditorProps) {
  const ruleSourceName = ruleId.ruleIdentifierToRuleSourceName(identifier);
  const {
    loading: loadingAlertRule,
    result: ruleWithLocation,
    error,
  } = useRuleWithLocation({ ruleIdentifier: identifier });

  const { isEditable, loading: loadingEditable } = useIsRuleEditable(ruleSourceName, ruleWithLocation?.rule);

  const loading = loadingAlertRule || loadingEditable;

  // @TODO test this
  if (error) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()}>
        <Alert severity="error" title="Failed to load rule">
          {stringifyErrorLike(error)}
        </Alert>
      </AlertingPageWrapper>
    );
  }

  if (loading) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()} isLoading={true}>
        <></>
      </AlertingPageWrapper>
    );
  }

  if (!ruleWithLocation && !loading) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()}>
        <AlertWarning title="Rule not found">Sorry! This rule does not exist.</AlertWarning>
      </AlertingPageWrapper>
    );
  }

  if (isEditable === false) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()}>
        <AlertWarning title="Cannot edit rule">Sorry! You do not have permission to edit this rule.</AlertWarning>
      </AlertingPageWrapper>
    );
  }

  // we shouldn't get here because loading / error handling happens before this
  if (!ruleWithLocation) {
    return null;
  }

  const returnTo = createViewLinkFromRuleWithLocation(ruleWithLocation);

  const rulerRule = ruleWithLocation.rule;
  const summary = getAnnotations(rulerRule)?.[Annotation.summary];

  const isFederatedRule = isFederatedRuleGroup(ruleWithLocation.group);
  const isPaused = isGrafanaRulerRule(rulerRule) && isGrafanaRulerRulePaused(rulerRule);
  const ruleOrigin = getRulePluginOrigin(rulerRule);

  return (
    <AlertingPageWrapper
      navId="alert-list"
      renderTitle={(name?: string) =>
        name ? <Title name={name} returnToHref={returnTo} paused={isPaused} ruleOrigin={ruleOrigin} /> : null
      }
      subTitle={
        <Stack direction="column">
          {isPaused && <InfoPausedRule />}
          {summary}
          {/* alerts and notifications and stuff */}
          {isFederatedRule && <FederatedRuleWarning />}
        </Stack>
      }
      pageNav={getPageNav({ text: ruleWithLocation.rule ? getRuleName(ruleWithLocation.rule) : '' })}
      info={createMetadata(ruleWithLocation)}
    >
      <AlertRuleForm existing={ruleWithLocation} />
    </AlertingPageWrapper>
  );
}

const getPageNav = (pageNavOptions?: Partial<NavModelItem>): NavModelItem => {
  return { ...defaultPageNav, id: 'alert-rule-edit', text: '', ...pageNavOptions };
};

const createMetadata = (ruleWithLocation: RuleWithLocation): PageInfoItem[] => {
  const { rule: rulerRule, group } = ruleWithLocation;
  const { labels } = rulerRule;

  const metadata: PageInfoItem[] = [];
  const hasLabels = !isEmpty(labels);

  const interval = group.interval;
  const pendingPeriod = getPendingPeriodFromRulerRule(rulerRule);

  if (isGrafanaRecordingRule(rulerRule)) {
    const metric = rulerRule.grafana_alert.record?.metric ?? '';
    metadata.push({
      label: 'Metric name',
      value: <Text color="primary">{metric}</Text>,
    });
  }

  if (interval) {
    metadata.push({
      label: 'Evaluation interval',
      value: <Text color="primary">Every {interval}</Text>,
    });
  }

  if (pendingPeriod) {
    metadata.push({
      label: 'Pending period',
      value: <Text color="primary">{stringifyPendingPeriod(pendingPeriod)}</Text>,
    });
  }

  if (hasLabels) {
    metadata.push({
      label: 'Labels',
      /* TODO truncate number of labels, maybe build in to component? */
      value: <AlertLabels labels={labels} size="sm" />,
    });
  }

  return metadata;
};
