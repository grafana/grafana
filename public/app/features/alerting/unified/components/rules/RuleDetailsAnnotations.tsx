import { css } from '@emotion/css';
import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { useAnnotationLinks } from '../../utils/annotations';
import { AnnotationDetailsField } from '../AnnotationDetailsField';

type Props = {
  annotations: Array<[string, string]>;
};

export function RuleDetailsAnnotations(props: Props): JSX.Element | null {
  const styles = useStyles2(getStyles);

  const { annotations } = props;
  const annotationLinks = useAnnotationLinks(annotations);

  if (annotations.length === 0) {
    return null;
  }

  return (
    <div className={styles.annotations}>
      {annotations.map(([key, value]) => (
        <AnnotationDetailsField key={key} annotationKey={key} value={value} valueLink={annotationLinks.get(key)} />
      ))}
    </div>
  );
}

const getStyles = () => ({
  annotations: css`
    margin-top: 46px;
  `,
});
