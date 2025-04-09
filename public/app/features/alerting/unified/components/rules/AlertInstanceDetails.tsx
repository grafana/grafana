import { t } from 'app/core/internationalization';
import { Alert } from 'app/types/unified-alerting';

import { useAnnotationLinks, useCleanAnnotations } from '../../utils/annotations';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { DetailsField } from '../DetailsField';

interface Props {
  instance: Alert;
}

export const AlertInstanceDetails = ({ instance }: Props) => {
  const annotations = useCleanAnnotations(instance.annotations);
  const annotationLinks = useAnnotationLinks(annotations);

  return (
    <div>
      {instance.value && (
        <DetailsField label={t('alerting.alert-instance-details.label-value', 'Value')} horizontal={true}>
          {instance.value}
        </DetailsField>
      )}
      {annotations.map(([key, value]) => {
        return (
          <AnnotationDetailsField key={key} annotationKey={key} value={value} valueLink={annotationLinks.get(key)} />
        );
      })}
    </div>
  );
};
