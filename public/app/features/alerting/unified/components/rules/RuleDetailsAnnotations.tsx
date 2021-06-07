import React from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';
import { AnnotationDetailsField } from '../AnnotationDetailsField';

type Props = {
  rule: CombinedRule;
};

export function RuleDetailsAnnotations(props: Props): JSX.Element | null {
  const { rule } = props;
  const styles = useStyles2(getStyles);
  const annotations = Object.entries(rule.annotations).filter(([_, value]) => !!value.trim());

  if (annotations.length === 0) {
    return null;
  }

  return (
    <div className={styles.annotations}>
      {annotations.map(([key, value]) => (
        <AnnotationDetailsField key={key} annotationKey={key} value={value} />
      ))}
    </div>
  );
}

const getStyles = () => ({
  annotations: css`
    margin-top: 46px;
  `,
});
