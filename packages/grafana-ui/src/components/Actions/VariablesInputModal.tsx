import { useState } from 'react';

import { ActionModel, ActionVariable } from '@grafana/data';

import { t } from '../../utils/i18n';
import { Input } from '../Input/Input';
import { Modal } from '../Modal/Modal';

interface Props {
  action: ActionModel;
  onDismiss: () => void;
}

/**
 * @internal
 */
export function VariablesInputModal({ action, onDismiss }: Props) {
  const [variables, setVariables] = useState(action.variables || []);

  const handleOnChange = (variable: ActionVariable, value: string) => {
    console.log('handleOnChange', variable, value);
    // const newVariables = variables.map((v) => (v.key === variable.key ? { ...v, key: value } : v));
    // setVariables(newVariables);
  };

  return (
    <Modal
      isOpen={true}
      title={t('grafana-ui.action-editor.button.action-variables-title', 'Action variables')}
      onDismiss={onDismiss}
    >
      <Input type="text" value={''} onChange={(e) => handleOnChange(variables[0], e.currentTarget.value)} width={20} />

      {/*<FieldSet>*/}
      {/*    {action.variables!.map((variable) => (*/}
      {/*      <Field key={variable.key} label={variable.name}>*/}
      {/*        <Input type="text" value={variable.key} onChange={(e) => { e.preventDefault(); e.stopPropagation(); handleOnChange(variable, e.currentTarget.value)}} width={20} onClick={handleOnClick}/>*/}
      {/*      </Field>*/}
      {/*    ))}*/}
      {/*</FieldSet>*/}
    </Modal>
  );
}
