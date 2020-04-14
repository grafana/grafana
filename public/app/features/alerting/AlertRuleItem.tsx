import React, { PureComponent } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import { AlertRule } from '../../types';
import { Icon, IconName } from '@grafana/ui';

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
          <button
            className="btn btn-small btn-inverse alert-list__btn width-2"
            title="Pausing an alert rule prevents it from executing"
            onClick={onTogglePause}
          >
            <Icon name={rule.state === 'paused' ? 'play' : 'pause'} />
          </button>
          <a className="btn btn-small btn-inverse alert-list__btn width-2" href={ruleUrl} title="Edit alert rule">
            <Icon name="cog" />
          </a>
        </div>
      </li>
    );
  }
}

export default AlertRuleItem;
