import React, { useCallback } from 'react';
import Highlighter from 'react-highlight-words';

import { Icon, IconName, Button, LinkButton, Card } from '@grafana/ui';

import { AlertRule } from '../../types';

export interface Props {
  rule: AlertRule;
  search: string;
  onTogglePause: () => void;
}

const AlertRuleItem = ({ rule, search, onTogglePause }: Props) => {
  const ruleUrl = `${rule.url}?editPanel=${rule.panelId}&tab=alert`;
  const renderText = useCallback(
    (text) => (
      <Highlighter
        key={text}
        highlightClassName="highlight-search-match"
        textToHighlight={text}
        searchWords={[search]}
      />
    ),
    [search]
  );

  return (
    <Card>
      <Card.Heading>{renderText(rule.name)}</Card.Heading>
      <Card.Figure>
        <Icon size="xl" name={rule.stateIcon as IconName} className={`alert-rule-item__icon ${rule.stateClass}`} />
      </Card.Figure>
      <Card.Meta>
        <span key="state">
          <span key="text" className={`${rule.stateClass}`}>
            {renderText(rule.stateText)}{' '}
          </span>
          for {rule.stateAge}
        </span>
        {rule.info ? renderText(rule.info) : null}
      </Card.Meta>
      <Card.Actions>
        <Button
          key="play"
          variant="secondary"
          icon={rule.state === 'paused' ? 'play' : 'pause'}
          onClick={onTogglePause}
        >
          {rule.state === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        <LinkButton key="edit" variant="secondary" href={ruleUrl} icon="cog">
          Edit alert
        </LinkButton>
      </Card.Actions>
    </Card>
  );
};

export default AlertRuleItem;
