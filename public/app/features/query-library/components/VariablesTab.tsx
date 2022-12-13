import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { LayerName } from 'app/core/components/Layers/LayerName';

import { SavedQuery, useUpdateSavedQueryMutation, Variable } from '../api/SavedQueriesApi';

import { SavedQueryUpdateOpts } from './QueryEditorDrawer';

type Props = {
  savedQuery: SavedQuery;
  options: SavedQueryUpdateOpts;
};

export const VariablesTab = ({ savedQuery, options }: Props) => {
  const styles = useStyles2(getStyles);

  const [updateSavedQuery] = useUpdateSavedQueryMutation();

  const onVariableNameChange = (variable: Variable, newName: string) => {
    const newVariables = savedQuery.variables.map((v: Variable) => {
      if (v.name === variable.name) {
        v.name = newName;
      }

      return v;
    });

    updateSavedQuery({
      query: {
        ...savedQuery,
        variables: newVariables,
      },
      opts: options,
    });
  };

  const onVariableValueChange = (variable: Variable, newValue: string) => {
    const newVariables = savedQuery.variables.map((v: Variable) => {
      if (v.name === variable.name) {
        v.current.value = newValue;
      }

      return v;
    });

    updateSavedQuery({
      query: {
        ...savedQuery,
        variables: newVariables,
      },
      opts: options,
    });
  };

  const onAddVariable = () => {
    // NOTE: doing mutation to force re-render
    savedQuery.variables.unshift({
      name: 'New variable',
      current: {
        value: 'General',
      },
    });

    updateSavedQuery({ query: savedQuery, opts: options });
  };

  const onRemoveVariable = (variable: Variable) => {
    const varIndex = savedQuery.variables.map((v: Variable, index: number) => {
      if (v.name === variable.name) {
        return index;
      }
      return;
    });

    if (typeof varIndex === 'number') {
      // NOTE: doing mutation vs filter to force re-render
      savedQuery.variables.splice(varIndex, 1);
      updateSavedQuery({ query: savedQuery, opts: options });
    }
  };

  return (
    <div className={styles.tabWrapper}>
      <div className={styles.variablesHeader}>
        <HorizontalGroup width="100%" justify="space-between" spacing={'md'} height={25}>
          <div className={styles.tabDescription}>
            Variables enable more interactive and dynamic queries. Instead of hard-coding things like server or sensor
            names in your metric queries you can use variables in their place. <br />
            <b>Variable support is coming soon!</b>
          </div>
          <Button icon="plus" size="md" className={styles.addVariableButton} onClick={onAddVariable}>
            Add variable
          </Button>
        </HorizontalGroup>
      </div>
      <div className={styles.variableList}>
        <ul>
          {savedQuery &&
            savedQuery.variables &&
            savedQuery.variables.map((variable: Variable) => (
              <li key={variable && variable.name} className={styles.variableListItem}>
                <Card>
                  <Card.Heading>
                    <LayerName
                      name={variable && variable.name}
                      onChange={(v) => onVariableNameChange(variable, v)}
                      overrideStyles
                    />
                  </Card.Heading>
                  <Card.Description>
                    <LayerName
                      name={variable && variable.current.value.toString()}
                      onChange={(v) => onVariableValueChange(variable, v)}
                      overrideStyles
                    />
                  </Card.Description>
                  <Card.Tags>
                    <Button
                      icon="trash-alt"
                      size="sm"
                      variant={'secondary'}
                      tooltip="Delete this variable"
                      onClick={() => onRemoveVariable(variable)}
                    >
                      Delete
                    </Button>
                  </Card.Tags>
                </Card>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    tabWrapper: css`
      flex: 1;
      padding: 20px 5px 5px 5px;
    `,
    tabDescription: css`
      color: ${theme.colors.text.secondary};
    `,
    variableList: css`
      padding-bottom: 20px;
    `,
    variableListItem: css`
      list-style: none;
    `,
    addVariableButton: css`
      display: flex;
      align-self: center;
      margin: auto;
      margin-bottom: 15px;
    `,
    variablesHeader: css`
      margin-top: 15px;
      margin-bottom: 20px;
    `,
  };
};
