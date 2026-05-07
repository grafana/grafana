import type { ReactNode } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

export type InstanceStateType = 'nodata' | 'error';

const BANNER_CONFIG: Record<InstanceStateType, { titleKey: string; titleDefault: string; description: ReactNode }> = {
  nodata: {
    titleKey: 'alerting.instance-details.state-nodata.title',
    titleDefault: 'No data state',
    description: (
      <Trans i18nKey="alerting.instance-details.state-nodata.description">
        This instance is in <strong>No data</strong> state. The alert fired because the query returned no data in the
        evaluation window, so a graph may not be available.
      </Trans>
    ),
  },
  error: {
    titleKey: 'alerting.instance-details.state-error.title',
    titleDefault: 'Error state',
    description: (
      <Trans i18nKey="alerting.instance-details.state-error-description">
        This instance is in <strong>Error</strong> state. An evaluation error occurred, so a graph may not be available.
      </Trans>
    ),
  },
};

interface InstanceStateInfoBannerProps {
  state: InstanceStateType;
}

/**
 * Info banner shown above the query graph when the instance is in NoData or Error state.
 */
export function InstanceStateInfoBanner({ state }: InstanceStateInfoBannerProps) {
  const { titleKey, titleDefault, description } = BANNER_CONFIG[state];
  return (
    <Alert severity="info" title={t(titleKey, titleDefault)}>
      {description}
    </Alert>
  );
}
