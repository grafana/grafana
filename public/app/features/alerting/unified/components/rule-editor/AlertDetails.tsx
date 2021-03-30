import React, { FC } from 'react';
import { FieldSet, FormAPI } from '@grafana/ui';
import LabelsField from './LabelsField';
import AnnotationsField from './AnnotationsField';

interface Props extends FormAPI<{}> {}

const AlertDetails: FC<Props> = (props) => {
  return (
    <FieldSet label="Add details for your alert">
      <AnnotationsField {...props} />
      <LabelsField {...props} />
    </FieldSet>
  );
};

export default AlertDetails;
