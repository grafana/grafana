import { LabelMatcher } from '@grafana/alerting/unstable';
import { matcherToOperator } from 'app/features/alerting/unified/utils/alertmanager';
import { invertMatcher, parsePromQLStyleMatcherLooseSafe } from 'app/features/alerting/unified/utils/matchers';
import { Silence, SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { AlertListPanelOptions } from './types';

export function createFilter(
  options: Pick<AlertListPanelOptions, 'folder' | 'stateFilter' | 'alertInstanceLabelFilter'>,
  replaceVariables?: (value: string) => string,
  silences?: Silence[]
) {
  let stateFilters: Array<'firing' | 'pending'> = [];
  const matchers: Array<[string, LabelMatcher['type'], string]> = [];

  if (options.folder?.title) {
    // sadly we don't seem to record the folder UIDs
    matchers.push(['grafana_folder', '=', options.folder.title]);
  }

  if (options.stateFilter.firing) {
    stateFilters.push('firing');
  }

  if (options.stateFilter.pending) {
    stateFilters.push('pending');
  }

  matchers.push(['alertstate', '=~', stateFilters.join('|')]);

  // Add custom label matchers if provided
  if (options.alertInstanceLabelFilter) {
    const interpolated = replaceVariables
      ? replaceVariables(options.alertInstanceLabelFilter)
      : options.alertInstanceLabelFilter;

    const parsedMatchers = parsePromQLStyleMatcherLooseSafe(interpolated);
    parsedMatchers.forEach((matcher) => {
      const operator = matcherToOperator(matcher);
      matchers.push([matcher.name, operator, matcher.value]);
    });
  }

  // Add inverted silence matchers to exclude silenced alerts
  if (silences) {
    const activeSilences = silences.filter((silence) => silence.status.state === SilenceState.Active);
    activeSilences.forEach((silence) => {
      if (silence.matchers) {
        silence.matchers.forEach((matcher) => {
          const invertedMatcher = invertMatcher(matcher);
          const operator = matcherToOperator(invertedMatcher);
          matchers.push([invertedMatcher.name, operator, invertedMatcher.value]);
        });
      }
    });
  }

  return matchers.map(([label, operator, value]) => `${label}${operator}"${value}"`).join(',');
}
