import { css } from '@emotion/css';
import React from 'react';

import { DataQuery, GrafanaTheme2 } from '@grafana/data';
import { Button, Card, IconButton, useStyles2 } from '@grafana/ui';
import { LayerName } from 'app/core/components/Layers/LayerName';

import { SavedQuery, useUpdateSavedQueryMutation } from '../api/SavedQueriesApi';

type Props = {
  savedQuery: SavedQuery<DataQuery>;
};

export const VariablesTab = ({ savedQuery }: Props) => {
  const styles = useStyles2(getStyles);

  const [updateSavedQuery] = useUpdateSavedQueryMutation();

  const onVariableNameChange = (variable: any, newName: string) => {
    const newVariables = savedQuery.variables.map((v: any) => {
      if (v.name === variable.name) {
        v.name = newName;
      }

      return v;
    });

    const newSavedQuery = {
      ...savedQuery,
      variables: newVariables,
    } as SavedQuery<DataQuery>;

    updateSavedQuery(newSavedQuery);
  };

  const onVariableValueChange = (variable: any, newValue: string) => {
    const newVariables = savedQuery.variables.map((v: any) => {
      if (v.name === variable.name) {
        v.current.value = newValue;
      }

      return v;
    });

    const newSavedQuery = {
      ...savedQuery,
      variables: newVariables,
    } as SavedQuery<DataQuery>;

    updateSavedQuery(newSavedQuery);
  };

  const onAddVariable = () => {
    // NOTE: doing mutation to force re-render
    savedQuery.variables.unshift({
      name: 'New var',
      current: {
        value: 'test',
      },
    });

    updateSavedQuery(savedQuery);
  };

  const onRemoveVariable = (variable: any) => {
    const varIndex: number | undefined = savedQuery.variables.map((v: any, index: number) => {
      if (v.name === variable.name) {
        return index;
      }
    });

    if (varIndex) {
      // NOTE: doing mutation vs filter to force re-render
      savedQuery.variables.splice(varIndex, 1);
      updateSavedQuery(savedQuery);
    }
  };

  return (
    <div className={styles.tabWrapper}>
      <div className={styles.tabDescription}>
        Variables enable more interactive and dynamic queries. Instead of hard-coding things like server or sensor names
        in your metric queries you can use variables in their place.
      </div>
      <Button className={styles.addVariableButton} onClick={onAddVariable}>
        Add new
      </Button>
      <div className={styles.variableList}>
        <ul>
          {savedQuery &&
            savedQuery.variables &&
            savedQuery.variables.map((variable: any) => (
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
                      name={variable && variable.current.value}
                      onChange={(v) => onVariableValueChange(variable, v)}
                      overrideStyles
                    />
                  </Card.Description>
                  <Card.Tags>
                    <IconButton
                      className={styles.deleteButton}
                      key="delete"
                      name="trash-alt"
                      tooltip="Delete this variable"
                      onClick={() => onRemoveVariable(variable)}
                    />
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
    `,
    tabDescription: css`
      margin-top: 10px;
      margin-bottom: 10px;
      color: ${theme.colors.text.secondary};
    `,
    variableList: css`
      padding-bottom: 20px;
    `,
    variableListItem: css`
      list-style: none;
    `,
    deleteButton: css`
      display: flex;
      align-self: flex-end;
    `,
    addVariableButton: css`
      display: flex;
      align-self: center;
      margin: auto;
      margin-bottom: 15px;
    `,
  };
};
