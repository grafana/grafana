import { isNumber } from 'lodash';
import { ReactNode } from 'react';

import { IconName, intervalToAbbreviatedDurationString } from '@grafana/data';
import { Icon, Stack, Text, TextLink } from '@grafana/ui';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { PluginOriginBadge } from '../../../plugins/PluginOriginBadge';
import { RulePluginOrigin } from '../../../utils/rules';
import { MetaText } from '../../MetaText';
import { ProvisioningBadge } from '../../Provisioning';

import { ListItem } from './ListItem';

interface AlertRuleListItemProps {
  name: string;
  href: string;
  isProvisioned?: boolean;
  summary?: string;
  error?: string;
  state?: PromAlertingRuleState;
  namespace?: CombinedRuleNamespace;
  group?: string;
  firstActiveAt?: Date;
  instanceCount?: number;
  origin?: RulePluginOrigin;
  actions?: ReactNode;
}

export const AlertRuleListItem = ({
  name,
  href,
  summary,
  isProvisioned,
  state,
  error,
  namespace,
  group,
  firstActiveAt,
  instanceCount,
  origin,
  actions = null,
}: AlertRuleListItemProps) => {
  const icons: Record<PromAlertingRuleState, IconName> = {
    [PromAlertingRuleState.Inactive]: 'check',
    [PromAlertingRuleState.Pending]: 'hourglass',
    [PromAlertingRuleState.Firing]: 'exclamation-circle',
  };

  const color: Record<PromAlertingRuleState, 'success' | 'error' | 'warning'> = {
    [PromAlertingRuleState.Inactive]: 'success',
    [PromAlertingRuleState.Pending]: 'warning',
    [PromAlertingRuleState.Firing]: 'error',
  };

  // assemble metadata
  const metadata: ReactNode[] = [];
  const metadataRight: ReactNode[] = [];

  if (error) {
    metadata.push(
      <Text color="error" variant="bodySmall" truncate>
        {error}
      </Text>
    );
  } else {
    if (namespace && group) {
      metadata.push(
        <Text color="secondary" variant="bodySmall">
          <RuleLocation namespace={namespace} group={group} />
        </Text>
      );
    }

    if (state === PromAlertingRuleState.Firing && firstActiveAt) {
      metadata.push(
        <MetaText icon="clock-nine">
          Firing for{' '}
          <span title={firstActiveAt.toLocaleString()}>
            {intervalToAbbreviatedDurationString({
              start: firstActiveAt,
              end: Date.now(),
            })}
          </span>
        </MetaText>
      );
    }

    if (state === PromAlertingRuleState.Pending && firstActiveAt) {
      metadata.push(
        <MetaText icon="clock-nine">
          Pending for{' '}
          {intervalToAbbreviatedDurationString({
            start: firstActiveAt,
            end: Date.now(),
          })}
        </MetaText>
      );
    }
  }

  if (origin) {
    metadataRight.push(<PluginOriginBadge pluginId={origin.pluginId} size="sm" />);
  }

  if (isNumber(instanceCount) && isFinite(instanceCount)) {
    metadataRight.push(<MetaText icon="layer-group">{instanceCount}</MetaText>);
  }

  return (
    <ListItem
      icon={
        <Text color={state ? color[state] : 'secondary'}>
          <Icon name={state ? icons[state] : 'circle'} size="lg" />
        </Text>
      }
      title={
        <Stack direction="row" alignItems="center">
          <TextLink href={href} inline={false}>
            {name}
          </TextLink>
          {isProvisioned && <ProvisioningBadge />}
        </Stack>
      }
      description={
        summary ? (
          <Text variant="bodySmall" color="secondary">
            {summary}
          </Text>
        ) : null
      }
      meta={metadata}
      metaRight={metadataRight}
      actions={actions}
    />
  );
};

interface RuleLocationProps {
  namespace: CombinedRuleNamespace;
  group: string;
}

export const RuleLocation = ({ namespace, group }: RuleLocationProps) => (
  <Stack direction="row" alignItems="center" gap={0.5}>
    <Icon size="xs" name="folder" />
    <Stack direction="row" alignItems="center" gap={0}>
      {namespace.name}
      <Icon size="sm" name="angle-right" />
      {group}
    </Stack>
  </Stack>
);
