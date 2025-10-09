import { t } from '@grafana/i18n';

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
      <p>{t('extensions.dependency-graph.no-data', 'No plugin dependency data available')}</p>
      <p>
        {t(
          'extensions.dependency-graph.configure-data-source',
          'Configure your data source to provide plugin relationships'
        )}
      </p>
      <p>
        {t('extensions.dependency-graph.debug-info', 'Debug: width={{width}}, height={{height}}, data keys: {{keys}}', {
          width,
          height,
          keys: Object.keys(data).join(', '),
        })}
      </p>
    </div>
  );
}
