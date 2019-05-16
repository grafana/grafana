import React, { PureComponent } from 'react';
// @ts-ignore
import Highlighter from 'react-highlight-words';
import classNames from 'classnames';
import { AlertRule } from '../../types';

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

    const iconClassName = classNames({
      fa: true,
      'fa-play': rule.state === 'paused',
      'fa-pause': rule.state !== 'paused',
    });

    const ruleUrl = `${rule.url}?panelId=${rule.panelId}&fullscreen&edit&tab=alert`;

    return (
      <li className="alert-rule-item">
        <span className={`alert-rule-item__icon ${rule.stateClass}`}>
          <i className={rule.stateIcon} />
        </span>
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
            <i className={iconClassName} />
          </button>
          <a className="btn btn-small btn-inverse alert-list__btn width-2" href={ruleUrl} title="Edit alert rule">
            <i className="gicon gicon-cog" />
          </a>
        </div>
      </li>
    );
  }
}

export default AlertRuleItem;
