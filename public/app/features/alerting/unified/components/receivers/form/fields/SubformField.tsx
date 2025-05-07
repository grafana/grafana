import { useState } from 'react';
import { DeepMap, FieldError, useFormContext } from 'react-hook-form';

import { Button, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { NotificationChannelOption, NotificationChannelSecureFields, OptionMeta } from 'app/types';

import { ActionIcon } from '../../../rules/ActionIcon';

import { OptionField } from './OptionField';
import { getReceiverFormFieldStyles } from './styles';

interface Props {
  defaultValue: any;
  option: NotificationChannelOption;
  getOptionMeta?: (option: NotificationChannelOption) => OptionMeta;
  pathPrefix: string;
  errors?: DeepMap<any, FieldError>;
  readOnly?: boolean;
  secureFields: NotificationChannelSecureFields;
  /**
   * Callback function to delete a subform field. Removal requires side effects
   * like settings and secure fields cleanup.
   */
  onDelete?: (propertyName: string) => void;
  onResetSecureField?: (propertyName: string) => void;
}

export const SubformField = ({
  option,
  pathPrefix,
  errors,
  defaultValue,
  getOptionMeta,
  readOnly = false,
  secureFields,
  onDelete,
  onResetSecureField,
}: Props) => {
  const styles = useStyles2(getReceiverFormFieldStyles);
  const name = `${pathPrefix}${option.propertyName}`;
  const { watch } = useFormContext();
  const _watchValue = watch(name);
  const value = _watchValue === undefined ? defaultValue : _watchValue;

  const [show, setShow] = useState(!!value);

  const onDeleteClick = () => {
    onDelete?.(option.propertyName);
    setShow(false);
  };

  return (
    <div className={styles.wrapper} data-testid={`${name}.container`}>
      <h6>{option.label}</h6>
      {option.description && <p className={styles.description}>{option.description}</p>}
      {show && (
        <>
          {!readOnly && onDelete && (
            <ActionIcon
              data-testid={`${name}.delete-button`}
              icon="trash-alt"
              tooltip={t('alerting.subform-field.tooltip-delete', 'delete')}
              onClick={onDeleteClick}
              className={styles.deleteIcon}
            />
          )}
          {(option.subformOptions ?? []).map((subOption) => {
            return (
              <OptionField
                readOnly={readOnly}
                getOptionMeta={getOptionMeta}
                onResetSecureField={onResetSecureField}
                secureFields={secureFields}
                defaultValue={defaultValue?.[subOption.propertyName]}
                parentOption={option}
                key={subOption.propertyName}
                option={subOption}
                pathPrefix={`${name}.`}
                error={errors?.[subOption.propertyName]}
              />
            );
          })}
        </>
      )}
      {!show && !readOnly && (
        <Button
          className={styles.addButton}
          type="button"
          variant="secondary"
          icon="plus"
          size="sm"
          onClick={() => setShow(true)}
          data-testid={`${name}.add-button`}
        >
          <Trans i18nKey="alerting.subform-field.add">Add</Trans>
        </Button>
      )}
    </div>
  );
};
