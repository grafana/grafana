import { css } from '@emotion/css';
import React from 'react';

import { QueryConditionID, GrafanaTheme2, QueryConditionConfig, SelectableValue } from '@grafana/data';
import { Field, useStyles2, ValuePicker } from '@grafana/ui';

import { conditionsRegistry } from './ConditionsRegistry';

interface QueryConditionRowProps {
  condition: QueryConditionConfig;
  onChange: (options: any) => void;
}

const QueryConditionRow: React.FC<QueryConditionRowProps> = ({ condition, onChange }) => {
  const styles = useStyles2(getStyles);

  const conditionDef = conditionsRegistry.getIfExists(condition.id);
  if (!conditionDef) {
    console.error('No condition definition for ID ' + condition.id);

    return null;
  }

  const EditorComponent = conditionDef.editor;

  return (
    <div className={styles.condition}>
      <Field
        style={{ marginBottom: 0 }}
        label={`Condition: ${conditionDef.name}`}
        description={conditionDef.description}
      >
        <EditorComponent onChange={onChange} options={condition.options} />
      </Field>
    </div>
  );
};

interface QueryConditionsEditorProps {
  conditions?: QueryConditionConfig[];
  onChange: (i: number, options: any) => void;
  onAddCondition: (conditionId: QueryConditionID) => void;
}

export const QueryConditionsEditor: React.FC<QueryConditionsEditorProps> = ({
  conditions,
  onChange,
  onAddCondition,
}) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      {conditions?.map((c, i) => (
        <QueryConditionRow key={`${c.id}-${i}`} condition={c} onChange={(options: any) => onChange(i, options)} />
      ))}
      <ValuePicker
        icon="plus"
        label="Add query condition"
        variant="secondary"
        menuPlacement="auto"
        isFullWidth={true}
        size="md"
        options={conditionsRegistry
          .list()
          .filter((o) => !o.excludeFromPicker)
          .map<SelectableValue<QueryConditionID>>((i) => ({
            label: i.name,
            value: i.id as QueryConditionID,
            description: i.description,
          }))}
        onChange={(value) => onAddCondition(value.value!)}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    condition: css`
      padding: ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      margin-bottom: ${theme.spacing(0.5)};
    `,
  };
};
