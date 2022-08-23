import { shuffle } from 'lodash';
import React, { PureComponent } from 'react';

import { QueryEditorHelpProps } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import LokiLanguageProvider from '../language_provider';
import { LokiQuery } from '../types';

const DEFAULT_EXAMPLES = ['{job="default/prometheus"}'];
const PREFERRED_LABELS = ['job', 'app', 'k8s_app'];
const EXAMPLES_LIMIT = 5;

const LOGQL_EXAMPLES = [
  {
    title: 'Log pipeline',
    expression: '{job="mysql"} |= "metrics" | logfmt | duration > 10s',
    label:
      'This query targets the MySQL job, keeps logs that contain the substring "metrics", and then parses and filters the logs further.',
  },
  {
    title: 'Count over time',
    expression: 'count_over_time({job="mysql"}[5m])',
    label: 'This query counts all the log lines within the last five minutes for the MySQL job.',
  },
  {
    title: 'Rate',
    expression: 'rate(({job="mysql"} |= "error" != "timeout")[10s])',
    label:
      'This query gets the per-second rate of all non-timeout errors within the last ten seconds for the MySQL job.',
  },
  {
    title: 'Aggregate, count, and group',
    expression: 'sum(count_over_time({job="mysql"}[5m])) by (level)',
    label: 'Get the count of logs during the last five minutes, grouping by level.',
  },
];

export default class LokiCheatSheet extends PureComponent<QueryEditorHelpProps<LokiQuery>, { userExamples: string[] }> {
  declare userLabelTimer: ReturnType<typeof setTimeout>;
  state = {
    userExamples: [],
  };

  componentDidMount() {
    this.scheduleUserLabelChecking();
    reportInteraction('grafana_loki_cheatsheet_opened', {});
  }

  componentWillUnmount() {
    clearTimeout(this.userLabelTimer);
  }

  scheduleUserLabelChecking() {
    this.userLabelTimer = setTimeout(this.checkUserLabels, 1000);
  }

  checkUserLabels = async () => {
    // Set example from user labels
    const provider: LokiLanguageProvider = this.props.datasource?.languageProvider;
    if (provider.started) {
      const labels = provider.getLabelKeys() || [];
      const preferredLabel = PREFERRED_LABELS.find((l) => labels.includes(l));
      if (preferredLabel) {
        const values = await provider.getLabelValues(preferredLabel);
        const userExamples = shuffle(values)
          .slice(0, EXAMPLES_LIMIT)
          .map((value) => `{${preferredLabel}="${value}"}`);
        this.setState({ userExamples });
      }
    } else {
      this.scheduleUserLabelChecking();
    }
  };

  renderExpression(expr: string) {
    const { onClickExample } = this.props;
    const onClick = (query: LokiQuery) => {
      onClickExample(query);
      reportInteraction('grafana_loki_cheatsheet_example_clicked', {});
    };

    return (
      <div className="cheat-sheet-item__example" key={expr} onClick={(e) => onClick({ refId: 'A', expr })}>
        <code>{expr}</code>
      </div>
    );
  }

  render() {
    const { userExamples } = this.state;
    const hasUserExamples = userExamples.length > 0;

    return (
      <div>
        <h2>Loki Cheat Sheet</h2>
        <div className="cheat-sheet-item">
          <div className="cheat-sheet-item__title">See your logs</div>
          <div className="cheat-sheet-item__label">
            Start by selecting a log stream from the Log browser, or alternatively you can write a stream selector into
            the query field.
          </div>
          {hasUserExamples ? (
            <div>
              <div className="cheat-sheet-item__label">Here are some example streams from your logs:</div>
              {userExamples.map((example) => this.renderExpression(example))}
            </div>
          ) : (
            <div>
              <div className="cheat-sheet-item__label">Here is an example of a log stream:</div>
              {this.renderExpression(DEFAULT_EXAMPLES[0])}
            </div>
          )}
        </div>
        <div className="cheat-sheet-item">
          <div className="cheat-sheet-item__title">Combine stream selectors</div>
          {this.renderExpression('{app="cassandra",namespace="prod"}')}
          <div className="cheat-sheet-item__label">Returns all log lines from streams that have both labels.</div>
        </div>

        <div className="cheat-sheet-item">
          <div className="cheat-sheet-item__title">Filtering for search terms.</div>
          {this.renderExpression('{app="cassandra"} |~ "(duration|latency)s*(=|is|of)s*[d.]+"')}
          {this.renderExpression('{app="cassandra"} |= "exact match"')}
          {this.renderExpression('{app="cassandra"} != "do not match"')}
          <div className="cheat-sheet-item__label">
            <a href="https://grafana.com/docs/loki/latest/logql/#log-pipeline" target="logql">
              LogQL
            </a>{' '}
            supports exact and regular expression filters.
          </div>
        </div>
        {LOGQL_EXAMPLES.map((item) => (
          <div className="cheat-sheet-item" key={item.expression}>
            <div className="cheat-sheet-item__title">{item.title}</div>
            {this.renderExpression(item.expression)}
            <div className="cheat-sheet-item__label">{item.label}</div>
          </div>
        ))}
      </div>
    );
  }
}
