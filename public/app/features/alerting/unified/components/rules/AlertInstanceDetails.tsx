import { Alert } from 'app/types/unified-alerting';
import React, { FC } from 'react';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { DetailsField } from '../DetailsField';

interface Props {
  instance: Alert;
}

export const AlertInstanceDetails: FC<Props> = ({ instance }) => {
  const annotations = Object.entries(instance.annotations || {}) || [];

  return (
    <div>
      {instance.value && (
        <DetailsField label="Value" horizontal={true}>
          {instance.value}
        </DetailsField>
      )}
      {annotations.map(([key, value]) => (
        <AnnotationDetailsField key={key} annotationKey={key} value={value} />
      ))}
    </div>
  );
};
