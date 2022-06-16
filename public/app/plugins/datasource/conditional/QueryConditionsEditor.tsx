import { css } from '@emotion/css';
import React from 'react';

import { QueryConditionID, GrafanaTheme2, QueryConditionConfig, SelectableValue } from '@grafana/data';
import { Icon, Tooltip, useStyles2, ValuePicker } from '@grafana/ui';

import { queryConditionsRegistry } from './QueryConditionsRegistry';

interface QueryConditionRowProps {
  condition: QueryConditionConfig;
  onChange: (options: any) => void;
}

const QueryConditionRow: React.FC<QueryConditionRowProps> = ({ condition, onChange }) => {
  const styles = useStyles2(getStyles);

  const conditionDef = queryConditionsRegistry.getIfExists(condition.id);
  if (!conditionDef) {
    console.error('No condition definition for ID ' + condition.id);

    return null;
  }

  const EditorComponent = conditionDef.editor;

  return (
    <div className={styles.conditionWrapper}>
      <div className={styles.header}>
        <span className={styles.name}>Condition: {conditionDef.name}</span>
        {conditionDef.description && (
          <Tooltip content={conditionDef.description}>
            <Icon name="info-circle" />
          </Tooltip>
        )}
      </div>
      <div className={styles.conditionEditor}>
        <EditorComponent onChange={onChange} options={condition.options} />
      </div>
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
        options={queryConditionsRegistry
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
    header: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      padding: ${theme.spacing(0.5, 1)};
      font-size: ${theme.typography.body.fontSize};
      display: flex;
      align-items: center;
    `,
    name: css`
      margin-right: ${theme.spacing(1)};
    `,
    conditionWrapper: css`
      border-radius: ${theme.shape.borderRadius(1)};
      border: 1px solid ${theme.colors.border.weak};
      background: ${theme.colors.background.secondary};
      margin-bottom: ${theme.spacing(0.5)};
    `,
    conditionEditor: css`
      padding: ${theme.spacing(1, 1, 0, 1)};
    `,
  };
};
