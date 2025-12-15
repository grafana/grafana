import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { isV2StoredVersion } from 'app/features/dashboard/api/utils';

import { DashboardScene } from '../scene/DashboardScene';

interface DashboardConversionWarningBannerProps {
  dashboard: DashboardScene;
}

export function DashboardConversionWarningBanner({ dashboard }: DashboardConversionWarningBannerProps) {
  const { meta } = dashboard.useState();
  const conversionStatus = meta?.conversionStatus;
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = useStyles2(getStyles);

  // Show banner if:
  // 1. Conversion status exists
  // 2. Conversion didn't fail (dashboard was successfully converted)
  // 3. The stored version is v2 (v2alpha1 or v2beta1), meaning it was converted from v2 to v1
  if (!conversionStatus || conversionStatus.failed || !isV2StoredVersion(conversionStatus.storedVersion)) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      title={t(
        'dashboard-scene.conversion-warning-banner.message',
        'The Dynamic Dashboard feature is temporarily disabled'
      )}
      style={{ flex: 0 }}
    >
      <div>
        <Trans i18nKey="dashboard-scene.conversion-warning-banner.save-warning">
          Any dashboard created as or converted to a Dynamic Dashboard will open as a classic dashboard. Saving the
          dashboard could lead to losing already set up Dynamic Dashboard features.
        </Trans>
        {!isExpanded && (
          <div className={styles.buttonContainer}>
            <Button
              variant="secondary"
              size="sm"
              fill="text"
              onClick={() => setIsExpanded(true)}
              className={styles.linkButton}
            >
              <Trans i18nKey="dashboard-scene.conversion-warning-banner.read-more">Read more</Trans>
            </Button>
          </div>
        )}
        {isExpanded && (
          <div className={styles.expandedContent}>
            <Trans i18nKey="dashboard-scene.conversion-warning-banner.details">
              During this period, please be aware of the following:
            </Trans>
            <ul className={styles.detailsList}>
              <li>
                <Trans i18nKey="dashboard-scene.conversion-warning-banner.detail-tabs">
                  All tabs and rows will appear as classic rows
                </Trans>
              </li>
              <li>
                <Trans i18nKey="dashboard-scene.conversion-warning-banner.detail-grids">
                  All auto-grids will be shown as custom grids
                </Trans>
              </li>
              <li>
                <Trans i18nKey="dashboard-scene.conversion-warning-banner.detail-conditional">
                  Show/hide rules will not work
                </Trans>
              </li>
            </ul>
            <Trans i18nKey="dashboard-scene.conversion-warning-banner.recommendation">
              Once the feature is enabled again, your dashboards will render normally in their Dynamic Dashboard format.
              Because of this, we strongly recommend not making changes to these dashboards until the feature is turned
              back on, as edits made in classic mode may lead to unexpected results. Alternatively, you can save a copy
              of the dashboard using the &quot;Save as copy&quot; option, in the save dashboard menu.
            </Trans>
            <div className={styles.buttonContainer}>
              <Button
                variant="secondary"
                size="sm"
                fill="text"
                onClick={() => setIsExpanded(false)}
                className={styles.linkButton}
              >
                <Trans i18nKey="dashboard-scene.conversion-warning-banner.read-less">Read less</Trans>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Alert>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    linkButton: css({
      marginTop: 0,
      marginLeft: 0,
      paddingLeft: 0,
      paddingRight: 0,
      fontSize: '1rem',
      verticalAlign: 'baseline',
      color: theme.colors.text.link,
    }),
    buttonContainer: css({
      marginTop: theme.spacing(1),
    }),
    expandedContent: css({
      marginTop: theme.spacing(1),
    }),
    detailsList: css({
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(2.5),
    }),
  };
}
