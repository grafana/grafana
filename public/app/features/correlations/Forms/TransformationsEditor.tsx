import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FieldArray, Stack, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import TransformationsEditorRow from './TransformationEditorRow';

type Props = { readOnly: boolean };

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    fontSize: theme.typography.h5.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
  }),
});

export const TransformationsEditor = (props: Props) => {
  const { control, register } = useFormContext();
  const { readOnly } = props;

  const styles = useStyles2(getStyles);

  return (
    <>
      <input type="hidden" {...register('id')} />
      <FieldArray name="config.transformations" control={control}>
        {({ fields, append, remove }) => (
          <>
            <Stack direction="column" alignItems="flex-start">
              <div className={styles.heading}>
                <Trans i18nKey="correlations.transform.heading">Transformations</Trans>
              </div>
              {fields.length === 0 && (
                <div>
                  <Trans i18nKey="correlations.transform.no-transform">No transformations defined.</Trans>
                </div>
              )}
              {fields.length > 0 && (
                <div>
                  {fields.map((fieldVal, index) => {
                    return (
                      <TransformationsEditorRow
                        key={index}
                        value={fieldVal}
                        index={index}
                        readOnly={readOnly}
                        remove={remove}
                      />
                    );
                  })}
                </div>
              )}
              {!readOnly && (
                <Button
                  icon="plus"
                  onClick={() => append({ type: undefined }, { shouldFocus: false })}
                  variant="secondary"
                  type="button"
                >
                  <Trans i18nKey="correlations.transform.add-button">Add transformation</Trans>
                </Button>
              )}
            </Stack>
          </>
        )}
      </FieldArray>
    </>
  );
};
