import React, { FC, useState } from 'react';
import { FieldError, DeepMap, useFormContext } from 'react-hook-form';

import { Button, useStyles2 } from '@grafana/ui';
import { NotificationChannelOption } from 'app/types';

import { ActionIcon } from '../../../rules/ActionIcon';

import { OptionField } from './OptionField';
import { getReceiverFormFieldStyles } from './styles';

interface Props {
  defaultValue: any;
  option: NotificationChannelOption;
  pathPrefix: string;
  errors?: DeepMap<any, FieldError>;
  readOnly?: boolean;
}

export const SubformField: FC<Props> = ({ option, pathPrefix, errors, defaultValue, readOnly = false }) => {
  const styles = useStyles2(getReceiverFormFieldStyles);
  const name = `${pathPrefix}${option.propertyName}`;
  const { watch } = useFormContext();
  const _watchValue = watch(name);
  const value = _watchValue === undefined ? defaultValue : _watchValue;

  const [show, setShow] = useState(!!value);

  return (
    <div className={styles.wrapper} data-testid={`${name}.container`}>
      <h6>{option.label}</h6>
      {option.description && <p className={styles.description}>{option.description}</p>}
      {show && (
        <>
          {!readOnly && (
            <ActionIcon
              data-testid={`${name}.delete-button`}
              icon="trash-alt"
              tooltip="delete"
              onClick={() => setShow(false)}
              className={styles.deleteIcon}
            />
          )}
          {(option.subformOptions ?? []).map((subOption) => {
            return (
              <OptionField
                readOnly={readOnly}
                defaultValue={defaultValue?.[subOption.propertyName]}
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
          Add
        </Button>
      )}
    </div>
  );
};
