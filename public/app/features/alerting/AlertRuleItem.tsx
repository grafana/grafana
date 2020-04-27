import React, { PureComponent } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { AlertRule } from '../../types';
import { Icon, IconName, Button, Tooltip, LinkButton, HorizontalGroup } from '@grafana/ui';

export interface Props {
  rule: AlertRule;
  search: string;
  onTogglePause: () => void;
}

class AlertRuleItem extends PureComponent<Props> {
  renderText(text: string) {
    return (
      <Highlighter
        highlightClassName="highlight-search-match"
        textToHighlight={text}
        searchWords={[this.props.search]}
      />
    );
  }

  render() {
    const { rule, onTogglePause } = this.props;

    const ruleUrl = `${rule.url}?editPanel=${rule.panelId}&tab=alert`;

    return (
      <li className="alert-rule-item">
        <Icon size="xl" name={rule.stateIcon as IconName} className={`alert-rule-item__icon ${rule.stateClass}`} />
        <div className="alert-rule-item__body">
          <div className="alert-rule-item__header">
            <div className="alert-rule-item__name">
              <a href={ruleUrl}>{this.renderText(rule.name)}</a>
            </div>
            <div className="alert-rule-item__text">
              <span className={`${rule.stateClass}`}>{this.renderText(rule.stateText)}</span>
              <span className="alert-rule-item__time"> for {rule.stateAge}</span>
            </div>
          </div>
          {rule.info && <div className="small muted alert-rule-item__info">{this.renderText(rule.info)}</div>}
        </div>

        <div className="alert-rule-item__actions">
          <HorizontalGroup spacing="sm">
            <Tooltip placement="bottom" content="Pausing an alert rule prevents it from executing">
              <Button
                variant="secondary"
                size="sm"
                icon={rule.state === 'paused' ? 'play' : 'pause'}
                onClick={onTogglePause}
              />
            </Tooltip>
            <Tooltip placement="right" content="Edit alert rule">
              <LinkButton size="sm" variant="secondary" href={ruleUrl} icon="cog" />
            </Tooltip>
          </HorizontalGroup>
        </div>
      </li>
    );
  }
}

export default AlertRuleItem;
