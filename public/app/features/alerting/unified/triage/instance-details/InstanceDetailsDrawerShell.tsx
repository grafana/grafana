import { type ComponentProps, type ReactNode } from 'react';

import { t } from '@grafana/i18n';
import { Button, Drawer, Stack } from '@grafana/ui';
import { type GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { InstanceDetailsDrawerTitle } from './InstanceDetailsDrawerTitle';

export type InstanceDrawerSharedTitleProps = Pick<
  ComponentProps<typeof InstanceDetailsDrawerTitle>,
  'instanceLabels' | 'commonLabels' | 'alertState' | 'onOpenSilence'
>;

export function DrawerBackButton({ onClick }: { onClick: () => void }) {
  const backLabel = t('alerting.triage.instance-details-drawer.back', 'Back');
  return (
    <Stack direction="row" alignItems="center">
      <Button variant="secondary" size="sm" fill="text" icon="arrow-left" onClick={onClick} aria-label={backLabel}>
        {backLabel}
      </Button>
    </Stack>
  );
}

type InstanceDrilldownDrawerProps = {
  sharedTitleProps: InstanceDrawerSharedTitleProps;
  rule: GrafanaRuleDefinition;
  titleText: string;
  sectionLabel?: ReactNode;
  onClose: () => void;
  onBack: () => void;
  children: ReactNode;
};

/** Stacked drilldown panel: custom heading + back (contact point list/edit, future notification details, etc.). */
export function InstanceDrilldownDrawer({
  sharedTitleProps,
  rule,
  titleText,
  sectionLabel,
  onClose,
  onBack,
  children,
}: InstanceDrilldownDrawerProps) {
  return (
    <Drawer
      title={
        <InstanceDetailsDrawerTitle
          {...sharedTitleProps}
          rule={rule}
          titleText={titleText}
          sectionLabel={sectionLabel}
          hideActions
          showAlertState={false}
          titleSection={<DrawerBackButton onClick={onBack} />}
        />
      }
      onClose={onClose}
      size="md"
    >
      {children}
    </Drawer>
  );
}
