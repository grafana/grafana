import { css, cx } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, FieldSet, Input, TextArea, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useCorrelationsFormContext } from './correlationsFormContext';
import { FormDTO } from './types';
import { getInputId } from './utils';

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    maxWidth: theme.spacing(80),
  }),
  description: css({
    maxWidth: theme.spacing(80),
  }),
});

export const ConfigureCorrelationBasicInfoForm = () => {
  const { register, formState } = useFormContext<FormDTO>();
  const styles = useStyles2(getStyles);
  const { correlation, readOnly } = useCorrelationsFormContext();

  return (
    <>
      <FieldSet label={t('correlations.basic-info-form.title', 'Define correlation label (Step 1 of 3)')}>
        <Trans i18nKey="correlations.basic-info-form.sub-text">
          <p>Define text that will describe the correlation.</p>
        </Trans>
        <input type="hidden" {...register('type')} />
        <Field
          label={t('correlations.basic-info-form.label-label', 'Label')}
          description={t(
            'correlations.basic-info-form.label-description',
            'This name will be used as the label for the correlation. This will show as button text, a menu item, or hover text on a link.'
          )}
          className={styles.label}
          invalid={!!formState.errors.label}
          error={formState.errors.label?.message}
        >
          <Input
            id={getInputId('label', correlation)}
            {...register('label', {
              required: {
                value: true,
                message: t('correlations.basic-info-form.label-required', 'This field is required.'),
              },
            })}
            readOnly={readOnly}
            placeholder={t('correlations.basic-info-form.label-placeholder', 'e.g. Tempo traces')}
          />
        </Field>

        <Field
          label={t('correlations.basic-info-form.description-label', 'Description')}
          description={t(
            'correlations.basic-info-form.description-description',
            'Optional description with more information about the link'
          )}
          // the Field component automatically adds margin to itself, so we are forced to workaround it by overriding  its styles
          className={cx(styles.description)}
        >
          <TextArea id={getInputId('description', correlation)} {...register('description')} readOnly={readOnly} />
        </Field>
      </FieldSet>
    </>
  );
};
