import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { Button, Card, Icon, IconName, useStyles2 } from '@grafana/ui';
import { useRulesSourcesWithRuler } from 'app/features/alerting/unified/hooks/useRuleSourcesWithRuler';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { fetchAllPromBuildInfoAction } from 'app/features/alerting/unified/state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { useDispatch } from 'app/types';

import { Essentials } from './Essentials';
interface DataConfiguration {
  id: number;
  title: string;
  description: string;
  text: string;
  actionButtonTitle: string;
  isVisible: boolean;
  titleIcon?: IconName;
}

export function ConfigureIRM() {
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const dispatchReduxAction = useDispatch();
  useEffect(() => {
    dispatchReduxAction(fetchAllPromBuildInfoAction());
  }, [dispatchReduxAction]);
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const configuration: DataConfiguration[] = useMemo(() => {
    return [
      {
        id: 1,
        title: 'Connect datasource to recieve data',
        description: 'Before your start configuration you need to connect at least one datasource.',
        text: 'Configure IRM',
        actionButtonTitle: 'Connect',
        isVisible: rulesSourcesWithRuler.length === 0,
      },
      {
        id: 2,
        title: 'Essentials',
        titleIcon: 'star',
        description: 'Complete the basic configuration to start using the apps',
        text: 'Configure IRM',
        actionButtonTitle: 'View tasks',
        isVisible: true,
      },
    ];
  }, [rulesSourcesWithRuler]);

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
          config.isVisible && (
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
          )
        );
      })}
      {essentialsOpen && (
        <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
          <Essentials onClose={() => setEssentialsOpen(false)} />
        </AlertmanagerProvider>
      )}
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
