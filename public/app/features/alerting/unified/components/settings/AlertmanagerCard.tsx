import { capitalize } from 'lodash';
import React from 'react';

import { Card, Badge, Button, Stack, Text, TextLink } from '@grafana/ui';

import { ConnectionStatus } from '../../hooks/useExternalAmSelector';
import { ProvisioningBadge } from '../Provisioning';
import { WithReturnButton } from '../WithReturnButton';

interface Props {
  name: string;
  href?: string;
  url?: string;
  logo?: string;
  provisioned?: boolean;
  readOnly?: boolean;
  implementation?: string;
  receiving?: boolean;
  status?: ConnectionStatus;
  // functions
  onEditConfiguration: () => void;
  onDisable: () => void;
  onEnable: () => void;
}

export function AlertmanagerCard({
  name,
  href,
  url,
  logo = 'public/app/plugins/datasource/alertmanager/img/logo.svg',
  provisioned = false,
  readOnly = provisioned,
  implementation,
  receiving = false,
  status = 'unknown',
  onEditConfiguration,
  onEnable,
  onDisable,
}: Props) {
  return (
    <Card>
      <Card.Heading>
        <Stack alignItems="center" gap={1}>
          {href ? (
            <WithReturnButton title="Alerting settings" component={<TextLink href={href}>{name}</TextLink>} />
          ) : (
            name
          )}
          {provisioned && <ProvisioningBadge />}
        </Stack>
      </Card.Heading>
      <Card.Figure>
        <img alt={`logo for ${name}`} src={logo} />
      </Card.Figure>

      <Card.Meta>
        {implementation && capitalize(implementation)}
        {url && url}
      </Card.Meta>

      <Card.Description>
        {!receiving ? (
          <Text variant="bodySmall">Not receiving Grafana managed alerts</Text>
        ) : (
          <>
            {status === 'pending' && <Badge text="Activation in progress" color="orange" />}
            {status === 'active' && <Badge text="Receiving Grafana managed alerts" color="green" />}
            {status === 'dropped' && <Badge text="Failed to adopt Alertmanager" color="red" />}
            {status === 'inconclusive' && <Badge text="Inconclusive" color="orange" />}
          </>
        )}
      </Card.Description>

      {/* we'll use the "tags" area to append buttons and actions */}
      <Card.Tags>
        <Stack direction="row" gap={1}>
          <Button onClick={onEditConfiguration} icon={readOnly ? 'eye' : 'edit'} variant="secondary" fill="outline">
            {readOnly ? 'View configuration' : 'Edit configuration'}
          </Button>
          {provisioned ? null : (
            <>
              {receiving ? (
                <Button icon="times" variant="destructive" fill="outline" onClick={onDisable}>
                  Disable
                </Button>
              ) : (
                <Button icon="check" variant="secondary" fill="outline" onClick={onEnable}>
                  Enable
                </Button>
              )}
            </>
          )}
        </Stack>
      </Card.Tags>
    </Card>
  );
}
