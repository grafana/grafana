import { useFormContext, useFieldArray } from 'react-hook-form';

import { Trans } from '@grafana/i18n';
import { Button, Stack, Text } from '@grafana/ui';

import TransformationsEditorRow from './TransformationEditorRow';

type Props = { readOnly: boolean };

export const TransformationsEditor = (props: Props) => {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: 'config.transformations' });
  const { readOnly } = props;

  return (
    <>
      <input type="hidden" {...register('id')} />
      <Stack direction="column" alignItems="flex-start">
        <Text variant={'h5'}>
          <Trans i18nKey="correlations.transform.heading">Transformations</Trans>
        </Text>
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
  );
};
