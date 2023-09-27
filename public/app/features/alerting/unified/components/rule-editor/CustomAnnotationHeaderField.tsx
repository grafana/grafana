import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Input, useStyles2 } from '@grafana/ui';

interface CustomAnnotationHeaderFieldProps {
  field: { onChange: () => void; onBlur: () => void; value: string; name: string };
}

const CustomAnnotationHeaderField = ({ field }: CustomAnnotationHeaderFieldProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <span className={styles.annotationTitle}>Custom annotation name and content</span>
      <Input
        placeholder="Enter custom annotation name..."
        width={18}
        {...field}
        className={styles.customAnnotationInput}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annotationTitle: css`
    color: ${theme.colors.text.primary};
    margin-bottom: 3px;
  `,

  customAnnotationInput: css`
    margin-top: 5px;
    width: 100%;
  `,
});

export default CustomAnnotationHeaderField;
