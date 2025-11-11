import { DeepMap, FieldError, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';
import { useControlledFieldArray } from 'app/features/alerting/unified/hooks/useControlledFieldArray';
import {
  NotificationChannelOption,
  NotificationChannelSecureFields,
  OptionMeta,
} from 'app/features/alerting/unified/types/alerting';

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
  secureFields: NotificationChannelSecureFields;
  getOptionMeta?: (option: NotificationChannelOption) => OptionMeta;
}

export const SubformArrayField = ({
  option,
  pathPrefix,
  errors,
  defaultValues,
  readOnly = false,
  secureFields,
  getOptionMeta,
}: Props) => {
  const styles = useStyles2(getReceiverFormFieldStyles);
  const path = `${pathPrefix}${option.propertyName}`;
  const formAPI = useFormContext();
  const { fields, append, remove } = useControlledFieldArray({ name: path, formAPI, defaults: defaultValues });

  return (
    <div className={styles.wrapper}>
      <CollapsibleSection
        className={styles.collapsibleSection}
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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
                  getOptionMeta={getOptionMeta}
                  secureFields={secureFields}
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
