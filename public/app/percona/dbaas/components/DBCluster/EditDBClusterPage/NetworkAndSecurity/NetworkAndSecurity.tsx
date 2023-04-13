import { CheckboxField, TextInputField } from '@percona/platform-core';
import React, { FC } from 'react';
import { Field } from 'react-final-form';
import { FieldArray } from 'react-final-form-arrays';

import { Switch, useStyles, Button, Icon, Tooltip } from '@grafana/ui';

import FieldSet from '../../../../../shared/components/Form/FieldSet/FieldSet';

import { Messages } from './NetworkAndSecurity.messages';
import { getStyles } from './NetworkAndSecurity.styles';
import { NetworkAndSecurityFields, NetworkAndSecurityProps } from './NetworkAndSecurity.types';

export const NetworkAndSecurity: FC<NetworkAndSecurityProps> = ({ form }) => {
  const styles = useStyles(getStyles);
  const { expose } = form.getState().values;

  return (
    <FieldSet
      label={
        <div className={styles.fieldSetLabel}>
          <div>{Messages.fieldSets.expose}</div>
          <Tooltip content={Messages.tooltips.expose}>
            <Icon data-testid="eks-info-icon" name="info-circle" />
          </Tooltip>
          <div className={styles.fieldSetSwitch}>
            <Field name={NetworkAndSecurityFields.expose} type="checkbox">
              {({ input }) => (
                <Switch
                  data-testid="toggle-network-and-security"
                  {...input}
                  checked={undefined}
                  value={input.checked}
                />
              )}
            </Field>
          </div>
        </div>
      }
      data-testid="network-and-security"
    >
      {!!expose ? (
        <>
          <CheckboxField
            name={NetworkAndSecurityFields.internetFacing}
            label={Messages.labels.internetFacing}
            tooltipIcon="info-circle"
            tooltipText={Messages.tooltips.internetFacing}
          />
          <FieldArray name={NetworkAndSecurityFields.sourceRanges}>
            {({ fields }) => (
              <div className={styles.fieldsWrapper}>
                <Button
                  className={styles.button}
                  variant="secondary"
                  onClick={() => fields.push({ sourceRange: '' })}
                  icon="plus"
                >
                  {Messages.buttons.addNew}
                </Button>
                {fields.map((name, index) => (
                  <div key={name} className={styles.fieldWrapper}>
                    <TextInputField
                      name={`${name}.sourceRange`}
                      label={index === 0 ? Messages.labels.sourceRange : ''}
                      placeholder={Messages.placeholders.sourceRange}
                      fieldClassName={styles.field}
                    />
                    <Button
                      data-testid={`deleteButton-${index}`}
                      className={styles.deleteButton}
                      variant="secondary"
                      onClick={() => (index > 0 ? fields.remove(index) : fields.update(0, ''))}
                      icon="trash-alt"
                    />
                  </div>
                ))}
              </div>
            )}
          </FieldArray>
        </>
      ) : (
        <div />
      )}
    </FieldSet>
  );
};

export default NetworkAndSecurity;
