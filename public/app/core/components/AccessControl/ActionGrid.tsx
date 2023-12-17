import { css } from '@emotion/css';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { useContext, useMemo, useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Checkbox, Modal, HorizontalGroup, Button } from '@grafana/ui';

import { ResourceDescriptionCtx } from './ResourceDescription';
import type { ResourcePermission } from './types';

const FINE_GRAINED_ACTIONS_FOLDERS = ['folders', 'dashboards', 'alerts', 'annotations'];

type ActionTypes = {
  [key: string]: string | undefined;
  read?: string;
  write?: string;
  create?: string;
  delete?: string;
};

const ActionTypeNames = ['read', 'write', 'create', 'delete'];

type ActionMatrix = Record<string, ActionTypes>;

function getActionMatrix(actions: string[], resourceNames: string[]): ActionMatrix {
  const matrix: ActionMatrix = {};
  for (const action of actions) {
    if (resourceNames.some((n) => action.startsWith(`${n}:`))) {
      const a = action.split(':');
      if (a.length === 0) {
        throw new Error('unxpected action format');
      }
      const resource = a[0];
      const typeName = a[a.length - 1];
      if (!ActionTypeNames.includes(typeName)) {
        continue;
      }
      if (!Object.hasOwn(matrix, resource)) {
        matrix[resource] = {};
      }
      matrix[resource][typeName] = action;
    }
  }
  return matrix;
}

type ActionGridProps = {
  selectedActions: string[];
  setSelectedActions: (actions: string[]) => void;
};

// ActionGrid is a control for selecting a set of actions for a custom access level (fine-grained permissions)
export function ActionGrid({ selectedActions, setSelectedActions }: ActionGridProps) {
  const { fineGrainedActions, resource } = useContext(ResourceDescriptionCtx);
  const styles = useStyles2(getStyles);
  const actionMatrix = useMemo<ActionMatrix>(() => {
    switch (resource) {
      case 'folders':
        return getActionMatrix(fineGrainedActions, FINE_GRAINED_ACTIONS_FOLDERS);
      default:
        return {};
    }
  }, [resource, fineGrainedActions]);
  const resources = Object.keys(actionMatrix);

  const handleToggleAction = (action: string) => () => {
    const newActions = [...selectedActions];
    const idx = newActions.findIndex((a) => a === action);
    if (idx === -1) {
      newActions.push(action);
    } else {
      newActions.splice(idx, 1);
    }
    setSelectedActions(newActions);
  };

  return (
    <div className={styles.grid}>
      <div />
      <div>Read</div>
      <div>Write</div>
      <div>Create</div>
      <div>Delete</div>
      {resources.map((res, idx) => {
        const cls = classNames({
          [styles.gridItemStripe]: idx % 2 === 0,
        });
        const actions = actionMatrix[res];

        return (
          <React.Fragment key={res}>
            <div className={`${cls} resourceName`}>{res}</div>
            {ActionTypeNames.map((name) => {
              const action = actions[name];
              if (action === undefined) {
                // this action type is not available for this resource - render a disabled checkbox
                return (
                  <div key={name} className={cls}>
                    <Checkbox disabled />
                  </div>
                );
              }

              return (
                <div key={name} className={cls}>
                  <Checkbox checked={selectedActions.includes(action)} onChange={handleToggleAction(action)} />
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export type ActionGridModalResult = {
  actions?: string[];
  selection: 'cancel' | 'save';
};

export interface ActionGridModalProps extends ActionGridModalState {
  resource: string;
}

export type ActionGridModalState = {
  show: boolean;
  onClose: (res: ActionGridModalResult) => void;
  item?: ResourcePermission;
};

export const actionGridModalStateInit = (): ActionGridModalState => {
  return {
    show: false,
    onClose: () => {},
  };
};

export function ActionGridModal({ show, resource, item, onClose }: ActionGridModalProps) {
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  useEffect(() => {
    if (item === undefined) {
      return;
    }
    const { permission, actions } = item;
    if (isEmpty(permission) && Array.isArray(actions)) {
      setSelectedActions(actions);
    }
  }, [item]);

  function onSave() {
    onClose({
      actions: selectedActions,
      selection: 'save',
    });
    setSelectedActions([]);
  }

  return (
    <Modal title="Custom Permission" isOpen={show}>
      <p>Select a set of actions for a custom permission.</p>
      <ActionGrid selectedActions={selectedActions} setSelectedActions={setSelectedActions} />
      <Modal.ButtonRow>
        <HorizontalGroup spacing="md" justify="center">
          <Button
            variant="secondary"
            fill="outline"
            onClick={() =>
              onClose({
                selection: 'cancel',
              })
            }
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave}>
            Save
          </Button>
        </HorizontalGroup>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      '& > div': {
        padding: theme.spacing.x0_5,
      },
      '& > div.resourceName': {
        width: '100%',
        textAlign: 'right',
      },
      '& > div:not(.resourceName)': {
        width: '100%',
        textAlign: 'center',
      },
    }),
    gridItemStripe: css({
      background: theme.colors.background.primary,
    }),
  };
};
