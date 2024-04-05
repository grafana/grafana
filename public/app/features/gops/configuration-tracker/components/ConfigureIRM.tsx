import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';

import { Card, Button, Icon, useStyles2 } from '@grafana/ui';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';

import { Essentials } from './Essentials';

export function ConfigureIRM() {
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const [essentialsOpen, setEssentialsOpen] = useState(false);

  const configuration = [
    {
      id: 1,
      title: 'Connect datasource to recieve data',
      description: 'Before your start configuration you need to connect at least one datasource.',
      text: 'Configure IRM',
      actionButtonTitle: 'Connect',
    },
    {
      id: 2,
      title: 'Essentials',
      titleIcon: 'star',
      description: 'Complete the basic configuration to start using the apps',
      text: 'Configure IRM',
      actionButtonTitle: 'View tasks',
    },
  ];

  const handleActionClick = (configID: number) => {
    switch (configID) {
      case 1:
        history.push(DATASOURCES_ROUTES.New);
        break;
      case 2:
        setEssentialsOpen(true);
        break;
      default:
        return;
    }
  };

  return (
    <section className={styles.container}>
      {configuration.map((config) => {
        return (
          <Card key={config.id}>
            <Card.Heading className={styles.title}>
              {config.title}
              {config.titleIcon && <Icon name={config.titleIcon} />}
            </Card.Heading>

            <Card.Description className={styles.description}>{config.description}</Card.Description>
            <Card.Actions>
              <Button variant="secondary" className={styles.actions} onClick={() => handleActionClick(config.id)}>
                {config.actionButtonTitle}
              </Button>
            </Card.Actions>
          </Card>
        );
      })}
      {essentialsOpen && <Essentials onClose={() => setEssentialsOpen(false)} />}
    </section>
  );
}

const getStyles = () => ({
  container: css({
    marginBottom: 0,
    display: 'grid',
    gap: '24px',
    'grid-template-columns': ' 1fr 1fr',
  }),
  title: css({
    'justify-content': 'flex-start',
    gap: '4px',
  }),
  description: css({
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    overflow: 'hidden',
  }),
  actions: css({
    marginTop: '24px',
  }),
});
