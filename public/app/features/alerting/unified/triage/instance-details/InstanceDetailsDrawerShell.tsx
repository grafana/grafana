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

type InstanceMainDrawerProps = {
  sharedTitleProps: InstanceDrawerSharedTitleProps;
  rule: GrafanaRuleDefinition;
  onClose: () => void;
  children: ReactNode;
};

/** Rear stack panel: full instance title (actions, silence, etc.). */
export function InstanceMainDrawer({ sharedTitleProps, rule, onClose, children }: InstanceMainDrawerProps) {
  return (
    <Drawer title={<InstanceDetailsDrawerTitle {...sharedTitleProps} rule={rule} />} onClose={onClose} size="md">
      {children}
    </Drawer>
  );
}

type InstanceDrilldownDrawerProps = {
  sharedTitleProps: InstanceDrawerSharedTitleProps;
  rule: GrafanaRuleDefinition;
  titleText: string;
  onClose: () => void;
  onBack: () => void;
  children: ReactNode;
};

/** Stacked drilldown panel: custom heading + back (contact point list/edit, silence, future notification details, etc.). */
export function InstanceDrilldownDrawer({
  sharedTitleProps,
  rule,
  titleText,
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

type StackedInstanceDrawersProps = {
  sharedTitleProps: InstanceDrawerSharedTitleProps;
  rule: GrafanaRuleDefinition;
  onClose: () => void;
  onBack: () => void;
  drilldownTitleText: string;
  mainChildren: ReactNode;
  drilldownChildren: ReactNode;
};

/** Two stacked drawers: instance body behind, drilldown in front (e.g. silence). */
export function StackedInstanceDrawers({
  sharedTitleProps,
  rule,
  onClose,
  onBack,
  drilldownTitleText,
  mainChildren,
  drilldownChildren,
}: StackedInstanceDrawersProps) {
  return (
    <>
      <InstanceMainDrawer sharedTitleProps={sharedTitleProps} rule={rule} onClose={onClose}>
        {mainChildren}
      </InstanceMainDrawer>
      <InstanceDrilldownDrawer
        sharedTitleProps={sharedTitleProps}
        rule={rule}
        titleText={drilldownTitleText}
        onClose={onClose}
        onBack={onBack}
      >
        {drilldownChildren}
      </InstanceDrilldownDrawer>
    </>
  );
}

type StackedDrilldownPairProps = {
  sharedTitleProps: InstanceDrawerSharedTitleProps;
  rule: GrafanaRuleDefinition;
  onClose: () => void;
  onBack: () => void;
  rearTitleText: string;
  frontTitleText: string;
  rearChildren: ReactNode;
  frontChildren: ReactNode;
};

/** Two stacked drilldown drawers (e.g. contact point list → edit). */
export function StackedDrilldownDrawerPair({
  sharedTitleProps,
  rule,
  onClose,
  onBack,
  rearTitleText,
  frontTitleText,
  rearChildren,
  frontChildren,
}: StackedDrilldownPairProps) {
  return (
    <>
      <InstanceDrilldownDrawer
        sharedTitleProps={sharedTitleProps}
        rule={rule}
        titleText={rearTitleText}
        onClose={onClose}
        onBack={onBack}
      >
        {rearChildren}
      </InstanceDrilldownDrawer>
      <InstanceDrilldownDrawer
        sharedTitleProps={sharedTitleProps}
        rule={rule}
        titleText={frontTitleText}
        onClose={onClose}
        onBack={onBack}
      >
        {frontChildren}
      </InstanceDrilldownDrawer>
    </>
  );
}
