import { css } from '@emotion/css';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { CollapsableSection, Stack, useStyles2 } from '@grafana/ui';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { AlertManagerDataSource } from 'app/features/alerting/unified/utils/datasource';

import { ContactPointWithMetadata } from '../../../contact-points/utils';

import { ContactPointDetails } from './contactPoint/ContactPointDetails';
import { ContactPointSelector } from './contactPoint/ContactPointSelector';
import { MuteTimingFields } from './route-settings/MuteTimingFields';
import { RoutingSettings } from './route-settings/RouteSettings';

interface AlertManagerManualRoutingProps {
  alertManager: AlertManagerDataSource;
}

export function AlertManagerManualRouting({ alertManager }: AlertManagerManualRoutingProps) {
  const styles = useStyles2(getStyles);

  const alertManagerName = alertManager.name;

  const [selectedContactPointWithMetadata, setSelectedContactPointWithMetadata] = useState<
    ContactPointWithMetadata | undefined
  >();

  const onSelectContactPoint = (contactPoint?: ContactPointWithMetadata) => {
    setSelectedContactPointWithMetadata(contactPoint);
  };

  const { watch } = useFormContext<RuleFormValues>();
  const hasRouteSettings =
    watch(`contactPoints.${alertManagerName}.overrideGrouping`) ||
    watch(`contactPoints.${alertManagerName}.overrideTimings`) ||
    watch(`contactPoints.${alertManagerName}.muteTimeIntervals`)?.length > 0;

  return (
    <Stack direction="column">
      <Stack direction="row" alignItems="center">
        <div className={styles.firstAlertManagerLine} />
        <div className={styles.alertManagerName}>
          Alertmanager:
          <img src={alertManager.imgUrl} alt="Alert manager logo" className={styles.img} />
          {alertManagerName}
        </div>
        <div className={styles.secondAlertManagerLine} />
      </Stack>
      <Stack direction="row" gap={1} alignItems="center">
        <ContactPointSelector alertManager={alertManagerName} onSelectContactPoint={onSelectContactPoint} />
      </Stack>
      {selectedContactPointWithMetadata?.grafana_managed_receiver_configs && (
        <ContactPointDetails receivers={selectedContactPointWithMetadata.grafana_managed_receiver_configs} />
      )}
      <div className={styles.routingSection}>
        <CollapsableSection
          label="Muting, grouping and timings (optional)"
          isOpen={hasRouteSettings}
          className={styles.collapsableSection}
        >
          <Stack direction="column" gap={1}>
            <MuteTimingFields alertmanager={alertManagerName} />
            <RoutingSettings alertManager={alertManagerName} />
          </Stack>
        </CollapsableSection>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  firstAlertManagerLine: css({
    height: 1,
    width: theme.spacing(4),
    backgroundColor: theme.colors.secondary.main,
  }),
  alertManagerName: css({
    with: 'fit-content',
  }),
  secondAlertManagerLine: css({
    height: '1px',
    width: '100%',
    flex: 1,
    backgroundColor: theme.colors.secondary.main,
  }),
  img: css({
    marginLeft: theme.spacing(2),
    width: theme.spacing(3),
    height: theme.spacing(3),
    marginRight: theme.spacing(1),
  }),
  collapsableSection: css({
    width: 'fit-content',
    fontSize: theme.typography.body.fontSize,
  }),
  routingSection: css({
    display: 'flex',
    flexDirection: 'column',
    maxWidth: theme.breakpoints.values.xl,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    marginTop: theme.spacing(2),
  }),
});
