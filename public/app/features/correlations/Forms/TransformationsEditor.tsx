import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, FieldArray, useStyles2 } from '@grafana/ui';

import TransformationsEditorRow from './TransformationEditorRow';

type Props = { readOnly: boolean };

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css`
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.fontWeightRegular};
  `,
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
              <div className={styles.heading}>Transformations</div>
              {fields.length === 0 && <div> No transformations defined.</div>}
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
                  Add transformation
                </Button>
              )}
            </Stack>
          </>
        )}
      </FieldArray>
    </>
  );
};
