import { css } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { useAnnotationLinks } from '../../utils/annotations';
import { AnnotationDetailsField } from '../AnnotationDetailsField';
import { DetailsField } from '../DetailsField';

type Props = {
  annotations: Array<[string, string]>;
};

// LOGZ.IO GRAFANA CHANGE :: DEV-48578 - rca checkbox
const RcaAnnotionRow: React.FC = () => {
  return (
    <DetailsField label="RCA Annotations" horizontal={true}>
    on
    </DetailsField>
  );
}

export function RuleDetailsAnnotations(props: Props): JSX.Element | null {
  const styles = useStyles2(getStyles);

  const { annotations } = props;
  const annotationLinks = useAnnotationLinks(annotations);

  if (annotations.length === 0) {
    return null;
  }

  return (
    <div className={styles.annotations}>
      {annotations.map(([key, value]) => ( // LOGZ.IO GRAFANA CHANGE :: DEV-48578 - rca checkbox
          key === '__logzioAlertRCA__' ? <RcaAnnotionRow key={key} /> : (<AnnotationDetailsField key={key} annotationKey={key} value={value} valueLink={annotationLinks.get(key)} />)
      ))}
    </div>
  );
}

const getStyles = () => ({
  annotations: css`
    margin-top: 46px;
  `,
});
