import { truncate } from 'lodash';

import { t } from '@grafana/i18n';

import { MAX_MISSING_ENDPOINT_EXAMPLES } from './consts';
import { type GraphDataError } from './utils';

const truncateOptions = { length: 100, omission: '…' };

export function formatGraphDataError(error: GraphDataError): string {
  if (error.kind === 'missing-field') {
    return t(
      'nodeGraph.data-error.missing-field',
      'Cannot visualize graph data: the {{field}} field is required in the {{frame}} data frame.',
      { field: error.field, frame: error.frame }
    );
  }

  const message = t('nodeGraph.data-error.missing-endpoints', '', {
    count: error.affectedEdges,
    defaultValue_one: 'Cannot visualize graph data: {{count}} edge references a missing node.',
    defaultValue_other: 'Cannot visualize graph data: {{count}} edges reference missing nodes.',
  });

  const shownExamples = error.examples.slice(0, MAX_MISSING_ENDPOINT_EXAMPLES);
  const examples = shownExamples.map(({ edgeId, missing }) => {
    const missingEndpoints = missing
      .map(({ id, side }) =>
        t('nodeGraph.data-error.missing-endpoint', '{{side}} “{{id}}” is absent from the node data.', {
          side,
          id: truncate(id, truncateOptions),
          interpolation: { escapeValue: false },
        })
      )
      .join(' ');

    return t('nodeGraph.data-error.edge-example', 'Edge “{{edgeId}}”: {{missingEndpoints}}', {
      edgeId: truncate(edgeId, truncateOptions),
      missingEndpoints,
      interpolation: { escapeValue: false },
    });
  });

  const omittedEdges = error.affectedEdges - shownExamples.length;
  if (omittedEdges > 0) {
    examples.push(
      t('nodeGraph.data-error.omitted-edges', '', {
        count: omittedEdges,
        defaultValue_one: '{{count}} more affected edge not shown.',
        defaultValue_other: '{{count}} more affected edges not shown.',
      })
    );
  }

  return [
    message,
    ...examples,
    t(
      'nodeGraph.data-error.ensure-matching-nodes',
      'Ensure every edge source and target has a matching node after transformations.'
    ),
  ].join('\n');
}
