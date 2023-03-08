import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Drawer, Icon, ModalsController, useStyles2 } from '@grafana/ui';

import { SavedQuery } from '../api/SavedQueriesApi';

import { QueryEditorDrawer, SavedQueryUpdateOpts } from './QueryEditorDrawer';
import { QueryImportDrawer } from './QueryImportDrawer';

type Props = {
  onDismiss: () => void;
  updateComponent: () => void;
};

export const QueryCreateDrawer = ({ onDismiss, updateComponent }: Props) => {
  const styles = useStyles2(getStyles);

  const type: SavedQueryUpdateOpts['type'] = 'create-new';

  const closeDrawer = () => {
    onDismiss();
    updateComponent();
  };

  return (
    <Drawer
      title="Add new query"
      subtitle="You can create a new query from builder or import from file"
      onClose={onDismiss}
      width={'1000px'}
      expandable
      scrollableContent
    >
      <div>
        <Card>
          <Card.Heading>Create by query builder</Card.Heading>
          <Card.Description></Card.Description>
          <Card.Figure>
            <Icon name={'list-ui-alt'} className={styles.cardIcon} />
          </Card.Figure>
          <Card.Tags>
            <ModalsController>
              {({ showModal, hideModal }) => {
                return (
                  <Button
                    icon="plus"
                    size="md"
                    onClick={() => {
                      const savedQuery: SavedQuery = {
                        title: 'New Query',
                        variables: [],
                        queries: [
                          {
                            refId: 'A',
                            datasource: {
                              type: 'datasource',
                              uid: 'grafana',
                            },
                            queryType: 'randomWalk',
                          },
                        ],
                      };
                      showModal(QueryEditorDrawer, {
                        onDismiss: closeDrawer,
                        options: { type },
                        savedQuery,
                      });
                    }}
                  >
                    Create query
                  </Button>
                );
              }}
            </ModalsController>
          </Card.Tags>
        </Card>
        <Card>
          <Card.Heading>Import from file</Card.Heading>
          <Card.Description>Supported formats: JSON</Card.Description>
          <Card.Figure>
            <Icon name={'import'} className={styles.cardIcon} />
          </Card.Figure>
          <Card.Tags>
            <ModalsController>
              {({ showModal, hideModal }) => {
                return (
                  <Button
                    icon="arrow-right"
                    size="md"
                    onClick={() => {
                      showModal(QueryImportDrawer, {
                        onDismiss: closeDrawer,
                        options: { type },
                      });
                    }}
                  >
                    Next
                  </Button>
                );
              }}
            </ModalsController>
          </Card.Tags>
        </Card>
      </div>
    </Drawer>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardIcon: css`
      width: 30px;
      height: 30px;
    `,
  };
};
