import React, { useCallback } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { css } from 'emotion';
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
    text => (
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
    <li
      className={css`
        width: 100%;
      `}
    >
      <Card
        heading={<a href={ruleUrl}>{renderText(rule.name)}</a>}
        image={
          <Icon size="xl" name={rule.stateIcon as IconName} className={`alert-rule-item__icon ${rule.stateClass}`} />
        }
        metadata={[
          <span key="state">
            <span key="text" className={`${rule.stateClass}`}>
              {renderText(rule.stateText)}{' '}
            </span>
            for {rule.stateAge}
          </span>,
          rule.info ? renderText(rule.info) : null,
        ]}
        actions={[
          <Button variant="secondary" icon={rule.state === 'paused' ? 'play' : 'pause'} onClick={onTogglePause}>
            {rule.state === 'paused' ? 'Resume' : 'Pause'}
          </Button>,
          <LinkButton variant="secondary" href={ruleUrl} icon="cog">
            Edit alert
          </LinkButton>,
        ]}
      />
    </li>
  );
};

export default AlertRuleItem;
