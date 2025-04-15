import { DeepMap, FieldError, useFormContext } from 'react-hook-form';

import { Button, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { useControlledFieldArray } from 'app/features/alerting/unified/hooks/useControlledFieldArray';
import { NotificationChannelOption } from 'app/types';

import { ActionIcon } from '../../../rules/ActionIcon';
import { CollapsibleSection } from '../CollapsibleSection';

import { OptionField } from './OptionField';
import { getReceiverFormFieldStyles } from './styles';

interface Props {
  defaultValues?: any[];
  option: NotificationChannelOption;
  pathPrefix: string;
  errors?: Array<DeepMap<any, FieldError>>;
  readOnly?: boolean;
}

export const SubformArrayField = ({ option, pathPrefix, errors, defaultValues, readOnly = false }: Props) => {
  const styles = useStyles2(getReceiverFormFieldStyles);
  const path = `${pathPrefix}${option.propertyName}`;
  const formAPI = useFormContext();
  const { fields, append, remove } = useControlledFieldArray({ name: path, formAPI, defaults: defaultValues });

  return (
    <div className={styles.wrapper}>
      <CollapsibleSection
        className={styles.collapsibleSection}
        label={`${option.label} (${fields.length})`}
        description={option.description}
      >
        {(fields ?? defaultValues ?? []).map((field, itemIndex) => {
          return (
            <div key={itemIndex} className={styles.wrapper}>
              {!readOnly && (
                <ActionIcon
                  data-testid={`${path}.${itemIndex}.delete-button`}
                  icon="trash-alt"
                  tooltip={t('alerting.subform-array-field.tooltip-delete', 'delete')}
                  onClick={() => remove(itemIndex)}
                  className={styles.deleteIcon}
                />
              )}
              {option.subformOptions?.map((option) => (
                <OptionField
                  readOnly={readOnly}
                  defaultValue={field?.[option.propertyName]}
                  key={option.propertyName}
                  option={option}
                  pathPrefix={`${path}.${itemIndex}.`}
                  error={errors?.[itemIndex]?.[option.propertyName]}
                />
              ))}
            </div>
          );
        })}
        {!readOnly && (
          <Button
            data-testid={`${path}.add-button`}
            className={styles.addButton}
            type="button"
            variant="secondary"
            icon="plus"
            size="sm"
            onClick={() => append({ __id: String(Math.random()) })}
          >
            <Trans i18nKey="alerting.subform-array-field.add">Add</Trans>
          </Button>
        )}
      </CollapsibleSection>
    </div>
  );
};
