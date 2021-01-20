import React, { FC } from 'react';
import { css } from 'emotion';
import { Button, Card, Icon, LinkButton } from '@grafana/ui';
import { AlertDefinition } from 'app/types';

interface Props {
  alertDefinition: AlertDefinition;
}

export const AlertDefinitionItem: FC<Props> = ({ alertDefinition }) => {
  return (
    <li
      className={css`
        width: 100%;
      `}
    >
      <Card heading={alertDefinition.title}>
        <Card.Figure>
          <Icon size="xl" name="question-circle" className="alert-rule-item__icon" />
        </Card.Figure>
        <Card.Meta>
          <span key="state">
            <span key="text">{alertDefinition.description}</span>
          </span>
        </Card.Meta>
        <Card.Actions>
          <Button variant="secondary">Pause</Button>
          <LinkButton key="edit" variant="secondary" href="" icon="cog">
            Edit alert
          </LinkButton>
        </Card.Actions>
      </Card>
    </li>
  );
};
