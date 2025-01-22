import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Input, Label, useStyles2 } from '@grafana/ui';

interface CustomAnnotationHeaderFieldProps {
  field: { onChange: () => void; onBlur: () => void; value: string; name: string };
}

const CustomAnnotationHeaderField = ({ field }: CustomAnnotationHeaderFieldProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <Label htmlFor={field.name}>Custom annotation name and content</Label>
      <Input
        placeholder="Enter custom annotation name"
        width={18}
        {...field}
        className={styles.customAnnotationInput}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  customAnnotationInput: css({
    width: '100%',
  }),
});

export default CustomAnnotationHeaderField;
