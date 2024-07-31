import * as React from 'react';

import { Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { ContactPointSelector } from 'app/features/alerting/unified/components/notification-policies/ContactPointSelector';

export interface ContactPointsFilterSelectorProps {
  options: Array<{
    label: string;
    value: string;
    description: React.JSX.Element;
  }>;
  selectedContactPoint: string | undefined;
  onSelectContactPoint: (contactPoint: string) => void;
  refetchReceivers: () => Promise<unknown>;
}

export function ContactPointsFilterSelector({ onSelectContactPoint }: ContactPointsFilterSelectorProps) {
  return (
    <Stack direction="column" gap={0}>
      <Text variant="bodySmall">
        <Trans i18nKey="alerting.contactPointFilter.label">Contact point</Trans>
      </Text>
      <ContactPointSelector
        showRefreshButton
        selectProps={{
          onChange: (selectValue) => {
            onSelectContactPoint(selectValue.value?.name!);
          },
        }}
      />
    </Stack>
  );
}
