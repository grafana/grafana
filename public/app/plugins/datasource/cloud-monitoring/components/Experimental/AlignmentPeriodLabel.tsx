import { css } from '@emotion/css';
import React, { FC, useMemo } from 'react';

import { rangeUtil, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { ALIGNMENTS } from '../../constants';
import CloudMonitoringDatasource from '../../datasource';
import { CustomMetaData } from '../../types';

export interface Props {
  customMetaData: CustomMetaData;
  datasource: CloudMonitoringDatasource;
}

export const AlignmentPeriodLabel: FC<Props> = ({ customMetaData, datasource }) => {
  const { perSeriesAligner, alignmentPeriod } = customMetaData;
  const styles = useStyles2(getStyles);
  const formatAlignmentText = useMemo(() => {
    if (!alignmentPeriod || !perSeriesAligner) {
      return '';
    }

    const alignment = ALIGNMENTS.find((ap) => ap.value === datasource.templateSrv.replace(perSeriesAligner));
    const seconds = parseInt(alignmentPeriod ?? ''.replace(/[^0-9]/g, ''), 10);
    const hms = rangeUtil.secondsToHms(seconds);
    return `${hms} interval (${alignment?.text ?? ''})`;
  }, [datasource, perSeriesAligner, alignmentPeriod]);

  return <label className={styles.label}>{formatAlignmentText}</label>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    fontSize: 12,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
