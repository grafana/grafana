import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Input, useStyles2 } from '@grafana/ui';

interface CustomAnnotationHeaderFieldProps {
  field: { onChange: () => void; onBlur: () => void; value: string; name: string };
}

const CustomAnnotationHeaderField = ({ field }: CustomAnnotationHeaderFieldProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <span className={styles.annotationTitle}>
        <Trans i18nKey="alerting.custom-annotation-header-field.custom-annotation-name-and-content">
          Custom annotation name and content
        </Trans>
      </span>
      <Input
        placeholder={t(
          'alerting.custom-annotation-header-field.placeholder-enter-custom-annotation-name',
          'Enter custom annotation name...'
        )}
        width={18}
        {...field}
        className={styles.customAnnotationInput}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  annotationTitle: css({
    color: theme.colors.text.primary,
    marginBottom: '3px',
  }),

  customAnnotationInput: css({
    marginTop: '5px',
    width: '100%',
  }),
});

export default CustomAnnotationHeaderField;
