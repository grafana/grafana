import React, { PureComponent } from 'react';
import { shuffle } from 'lodash';
import { ExploreStartPageProps, DataQuery } from '@grafana/ui';
import LokiLanguageProvider from '../language_provider';

// const CHEAT_SHEET_ITEMS = [
//   {
//     title: 'See your logs',
//     label: '',
//   },
//   {
//     title: 'Logs from a "job"',
//     expression: '{job="default/prometheus"}',
//     label: 'Returns all log lines emitted by instances of this job.',
//   },
//   {
//     title: 'Combine stream selectors',
//     expression: '{app="cassandra",namespace="prod"}',
//     label: 'Returns all log lines from streams that have both labels.',
//   },
//   {
//     title: 'Search for text',
//     expression: '{app="cassandra"} (duration|latency)\\s*(=|is|of)\\s*[\\d\\.]+',
//     label: 'Add a regular expression after the selector to filter for.',
//   },
// ];

const DEFAULT_EXAMPLES = ['{job="default/prometheus"}'];
const PREFERRED_LABELS = ['job', 'app', 'k8s_app'];

export default class LokiCheatSheet extends PureComponent<ExploreStartPageProps, { userExamples: string[] }> {
  userLabelTimer: NodeJS.Timeout;
  state = {
    userExamples: DEFAULT_EXAMPLES,
  };

  componentDidMount() {
    this.scheduleUserLabelChecking();
  }

  componentWillUnmount() {
    clearTimeout(this.userLabelTimer);
  }

  scheduleUserLabelChecking() {
    this.userLabelTimer = setTimeout(this.checkUserLabels, 1000);
  }

  checkUserLabels = async () => {
    // Set example from user labels
    const provider: LokiLanguageProvider = this.props.datasource.languageProvider;
    if (provider.started) {
      const labels = provider.getLabelKeys() || [];
      const preferredLabel = PREFERRED_LABELS.find(l => labels.includes(l));
      if (preferredLabel) {
        const values = await provider.getLabelValues(preferredLabel);
        const userExamples = shuffle(values)
          .slice(0, 3)
          .map(value => `{${preferredLabel}="${value}"}`);
        this.setState({ userExamples });
      }
    } else {
      this.scheduleUserLabelChecking();
    }
  };

  render() {
    const { onClickExample } = this.props;
    const { userExamples } = this.state;

    return (
      <div>
        <h2>Loki Cheat Sheet</h2>
        <div className="cheat-sheet-item">
          <div className="cheat-sheet-item__title">See your logs</div>
          <div className="cheat-sheet-item__label">Start by selecting a log stream from the Log labels selector.</div>
          <div className="cheat-sheet-item__label">
            Alternatively, you can write a stream selector into the query field:
          </div>
          <div className="cheat-sheet-item__expression">
            <code>{'{job="default/prometheus"}'}</code>
          </div>
          {userExamples !== DEFAULT_EXAMPLES && userExamples.length > 0 ? (
            <div>
              <div className="cheat-sheet-item__label">Here are some example streams from your logs:</div>
              {userExamples.map(example => (
                <div
                  className="cheat-sheet-item__example"
                  key={example}
                  onClick={e => onClickExample({ refId: 'A', expr: example } as DataQuery)}
                >
                  <code>{example}</code>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="cheat-sheet-item">
          <div className="cheat-sheet-item__title">Combine stream selectors</div>
          <div className="cheat-sheet-item__expression">
            <code>{'{app="cassandra",namespace="prod"}'}</code>
          </div>
          <div className="cheat-sheet-item__label">Returns all log lines from streams that have both labels.</div>
        </div>

        <div className="cheat-sheet-item">
          <div className="cheat-sheet-item__title">Filtering for search terms.</div>
          <div className="cheat-sheet-item__expression">
            <code>{'{app="cassandra"} |~ "(duration|latency)s*(=|is|of)s*[d.]+"'}</code>
          </div>
          <div className="cheat-sheet-item__expression">
            <code>{'{app="cassandra"} |= "exact match"'}</code>
          </div>
          <div className="cheat-sheet-item__expression">
            <code>{'{app="cassandra"} != "do not match"'}</code>
          </div>
          <div className="cheat-sheet-item__label">
            <a href="https://github.com/grafana/loki/blob/master/docs/usage.md#filter-expression" target="logql">
              LogQL
            </a>{' '}
            supports exact and regular expression filters.
          </div>
        </div>
      </div>
    );
  }
}
