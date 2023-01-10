import { CheckboxField, TextInputField } from '@percona/platform-core';
import React, { FC } from 'react';
import { FieldArray } from 'react-final-form-arrays';

import { useStyles, Button } from '@grafana/ui';

import FieldSet from '../../../../../../shared/components/Form/FieldSet/FieldSet';
import { Messages } from '../DBClusterAdvancedOptions.messages';

import { getStyles } from './NetworkAndSecurity.styles';
import { NetworkAndSecurityFields, NetworkAndSecurityProps } from './NetworkAndSecurity.types';
export const NetworkAndSecurity: FC<NetworkAndSecurityProps> = ({ mode }) => {
  const styles = useStyles(getStyles);
  return (
    <FieldSet label={Messages.fieldSets.networkAndSecurity} data-testid="network-and-security">
      <CheckboxField
        name={NetworkAndSecurityFields.expose}
        label={Messages.labels.expose}
        tooltipIcon="info-circle"
        tooltipText={Messages.tooltips.expose}
        noError
        disabled={mode === 'edit'}
      />
      <CheckboxField
        name={NetworkAndSecurityFields.internetFacing}
        label={Messages.labels.internetFacing}
        disabled={mode === 'edit'}
      />
      <FieldArray name={NetworkAndSecurityFields.sourceRanges}>
        {({ fields }) => (
          <div className={styles.fieldsWrapper}>
            <Button
              className={styles.button}
              variant="secondary"
              onClick={() => fields.push({ sourceRange: '' })}
              icon="plus"
              disabled={mode === 'edit'}
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
                  disabled={mode === 'edit'}
                />
                {index > 0 && (
                  <Button
                    className={styles.deleteButton}
                    variant="secondary"
                    onClick={() => fields.remove(index)}
                    icon="trash-alt"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </FieldArray>
    </FieldSet>
  );
};

export default NetworkAndSecurity;
