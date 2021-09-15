import React, { FC, useMemo } from 'react';
import { rangeUtil } from '@grafana/data';
import { ALIGNMENTS } from '../constants';
import CloudMonitoringDatasource from '../datasource';
import { CustomMetaData } from '../types';

export interface Props {
  customMetaData: CustomMetaData;
  datasource: CloudMonitoringDatasource;
}

export const AlignmentPeriodLabel: FC<Props> = ({ customMetaData, datasource }) => {
  const { perSeriesAligner, alignmentPeriod } = customMetaData;
  const formatAlignmentText = useMemo(() => {
    if (!alignmentPeriod || !perSeriesAligner) {
      return '';
    }

    const alignment = ALIGNMENTS.find((ap) => ap.value === datasource.templateSrv.replace(perSeriesAligner));
    const seconds = parseInt(alignmentPeriod ?? ''.replace(/[^0-9]/g, ''), 10);
    const hms = rangeUtil.secondsToHms(seconds);
    return `${hms} interval (${alignment?.text ?? ''})`;
  }, [datasource, perSeriesAligner, alignmentPeriod]);

  return <label>{formatAlignmentText}</label>;
};
