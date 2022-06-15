import { capitalize } from 'lodash';

import { ConditionInfo, QueryConditionID, QueryConditionType } from '@grafana/data';
import { KeyValueVariableModel } from 'app/features/variables/types';

import { FieldValueClickConditionEditor, ValueClickConditionOptions } from './FieldValueClickConditionEditor';

const FIELD_VALUE_CLICK_VARIABLE_PREFIX = 'valueClick';

export const fieldValueClickCondition: ConditionInfo<ValueClickConditionOptions> = {
  id: QueryConditionID.ValueClick,
  type: QueryConditionType.Field,
  name: 'Field value click',
  description: 'When a value is clicked',
  defaultOptions: {},
  variablePrefix: FIELD_VALUE_CLICK_VARIABLE_PREFIX,
  execute: (options, context) => {
    const drilldownTplVars = context.variables.filter(
      (arg) =>
        (arg as KeyValueVariableModel).id.includes('valueClick') && (arg as KeyValueVariableModel).current.value !== ''
    );

    return (
      drilldownTplVars.filter((arg) => {
        const result = (arg as KeyValueVariableModel).name.replace('valueClick', '').match(capitalize(options.name));

        return result;
      }).length !== 0
    );
  },
  editor: FieldValueClickConditionEditor,
  getVariableName: (options: ValueClickConditionOptions) => {
    return `${FIELD_VALUE_CLICK_VARIABLE_PREFIX}${capitalize(options.name)}`;
  },
};
