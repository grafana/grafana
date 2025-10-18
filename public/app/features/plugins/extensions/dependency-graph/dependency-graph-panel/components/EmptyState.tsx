import { t } from '@grafana/i18n';
import { EmptyState as GrafanaEmptyState } from '@grafana/ui';

import { GraphData } from '../types';

import { getGraphStyles } from './GraphStyles';

interface EmptyStateProps {
  data: GraphData;
  width: number;
  height: number;
  styles: ReturnType<typeof getGraphStyles>;
}

/**
 * Empty state component for when no dependency graph data is available
 */
export function EmptyState({ data, width, height, styles }: EmptyStateProps): JSX.Element {
  return (
    <div className={styles.emptyState.toString()}>
      <GrafanaEmptyState
        variant="not-found"
        message={t('extensions.dependency-graph.no-data', 'No plugin dependency data available')}
      >
        <p>
          {t(
            'extensions.dependency-graph.configure-data-source',
            'Configure your data source to provide plugin relationships'
          )}
        </p>
        <details style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-color-secondary)' }}>
          <summary>{t('extensions.dependency-graph.debug-info-title', 'Debug Information')}</summary>
          <p>
            {t('extensions.dependency-graph.debug-info', 'Width: {{width}}, Height: {{height}}, Data keys: {{keys}}', {
              width,
              height,
              keys: Object.keys(data).join(', '),
            })}
          </p>
        </details>
      </GrafanaEmptyState>
    </div>
  );
}
