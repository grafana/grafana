import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { AlertManagerDataSource } from 'app/features/alerting/unified/utils/datasource';

import { useContactPointsWithStatus } from '../../../contact-points/useContactPoints';
import { ContactPointWithMetadata } from '../../../contact-points/utils';
import { RuleEditorSubSection } from '../../RuleEditorSection';

import { ContactPointDetails } from './contactPoint/ContactPointDetails';
import { ContactPointSelector } from './contactPoint/ContactPointSelector';
import { MuteTimingFields } from './route-settings/MuteTimingFields';
import { RoutingSettings } from './route-settings/RouteSettings';

interface AlertManagerManualRoutingProps {
  alertManager: AlertManagerDataSource;
}

export function AlertManagerContactPointRouting({ alertManager }: AlertManagerManualRoutingProps) {
  const styles = useStyles2(getStyles);
  const alertManagerName = alertManager.name;

  const { watch } = useFormContext<RuleFormValues>();
  const hasRouteSettings =
    watch(`contactPoints.${alertManagerName}.overrideGrouping`) ||
    watch(`contactPoints.${alertManagerName}.overrideTimings`) ||
    watch(`contactPoints.${alertManagerName}.muteTimeIntervals`)?.length > 0;

  const [showAdvancedPolicyOptions, toggleAdvancedPolicyOptions] = useToggle(hasRouteSettings);

  const [selectedContactPointWithMetadata, setSelectedContactPointWithMetadata] = useState<
    ContactPointWithMetadata | undefined
  >();

  const contactPointInForm = watch(`contactPoints.${alertManagerName}.selectedContactPoint`);
  const { contactPoints } = useContactPointsWithStatus({
    // we only fetch the contact points with metadata for the first time we render an existing alert rule
    alertmanager: alertManagerName,
    skip: Boolean(selectedContactPointWithMetadata),
  });
  const contactPointWithMetadata = contactPoints.find((cp) => cp.name === contactPointInForm);

  useEffect(() => {
    if (contactPointWithMetadata && !selectedContactPointWithMetadata) {
      onSelectContactPoint(contactPointWithMetadata);
    }
  }, [contactPointWithMetadata, selectedContactPointWithMetadata]);

  const onSelectContactPoint = (contactPoint?: ContactPointWithMetadata) => {
    setSelectedContactPointWithMetadata(contactPoint);
  };

  return (
    <>
      {/* contact point selector */}
      <RuleEditorSubSection>
        <Stack direction="column" gap={1}>
          <Stack direction="row" alignItems="center">
            <div className={styles.firstAlertManagerLine} />
            <Stack direction="row" alignItems="center" gap={1}>
              <img src={alertManager.imgUrl} alt="Alert manager logo" className={styles.img} />
              {alertManagerName}
            </Stack>
            <div className={styles.secondAlertManagerLine} />
          </Stack>
          <ContactPointSelector alertManager={alertManagerName} onSelectContactPoint={onSelectContactPoint} />
        </Stack>
        {/* show selected contact point details */}
        {selectedContactPointWithMetadata?.grafana_managed_receiver_configs && (
          <ContactPointDetails receivers={selectedContactPointWithMetadata.grafana_managed_receiver_configs} />
        )}
      </RuleEditorSubSection>

      {/* additional options for auto-created notification policy such as mute timing, group options, etc */}
      <RuleEditorSubSection
        title="Muting, grouping and timings"
        onToggle={toggleAdvancedPolicyOptions}
        isCollapsed={!showAdvancedPolicyOptions}
      >
        <MuteTimingFields alertmanager={alertManagerName} />
        <RoutingSettings alertManager={alertManagerName} />
      </RuleEditorSubSection>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  firstAlertManagerLine: css({
    height: 1,
    width: theme.spacing(4),
    backgroundColor: theme.colors.secondary.main,
  }),
  secondAlertManagerLine: css({
    height: '1px',
    width: '100%',
    flex: 1,
    backgroundColor: theme.colors.secondary.main,
  }),
  img: css({
    width: theme.spacing(3),
    height: theme.spacing(3),
  }),
});
