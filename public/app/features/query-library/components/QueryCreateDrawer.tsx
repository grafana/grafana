import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Drawer, Icon, useStyles2 } from '@grafana/ui';

import { CreateNewQuery } from './CreateNewQuery';

type Props = {
  onDismiss: () => void;
  updateComponent: () => void;
};

export const QueryCreateDrawer = ({ onDismiss, updateComponent }: Props) => {
  const styles = useStyles2(getStyles);

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
          <Card.Description>Configure rotations and shifts directly in Grafana On-Call</Card.Description>
          <Card.Figure>
            <Icon name={'list-ui-alt'} className={styles.cardIcon} />
          </Card.Figure>
          <Card.Tags>
            <Button icon="plus" size="md">
              Create query
            </Button>
          </Card.Tags>
        </Card>

        <Card>
          <Card.Heading>Import from file</Card.Heading>
          <Card.Description>Supported formats: JSON</Card.Description>
          <Card.Figure>
            <Icon name={'import'} className={styles.cardIcon} />
          </Card.Figure>
          <Card.Tags>
            <Button icon="arrow-right" size="md" variant={'secondary'}>
              Next
            </Button>
          </Card.Tags>
        </Card>
      </div>

      <div className={styles.addQuery}>
        <CreateNewQuery onDismiss={onDismiss} updateComponent={updateComponent} />
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
    addQuery: css`
      margin-top: 50px;
    `,
  };
};
