import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { TIME_OPTION_PLACEHOLDER } from '../constants';

import { QueryEditorBody } from './Body/QueryEditorBody';
import { QueryEditorDetailsSidebar } from './Body/QueryEditorDetailsSidebar';
import { FooterLabelValue, QueryEditorFooter } from './Footer/QueryEditorFooter';
import { ContentHeader } from './Header/ContentHeader';
import { useDatasourceContext, useQueryEditorUIContext, useQueryRunnerContext } from './QueryEditorContext';

export function QueryEditorContent() {
  const styles = useStyles2(getStyles);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { options } = useQueryEditorUIContext();
  const { data } = useQueryRunnerContext();
  const { datasource } = useDatasourceContext();

  // Compute footer items from actual query options
  // Items with isActive=true have non-default (user-set) values and are highlighted
  // Placeholder values match QueryEditorDetailsSidebar
  const footerItems: FooterLabelValue[] = useMemo(() => {
    const realMaxDataPoints = data?.request?.maxDataPoints;
    const realInterval = data?.request?.interval;
    const minIntervalOnDs = datasource?.interval ?? t('query-editor.footer.placeholder.no-limit', 'No limit');

    return [
      {
        id: 'maxDataPoints',
        label: t('query-editor.footer.label.max-data-points', 'Max data points'),
        value: options.maxDataPoints != null ? String(options.maxDataPoints) : String(realMaxDataPoints ?? '-'),
        isActive: options.maxDataPoints != null,
      },
      {
        id: 'minInterval',
        label: t('query-editor.footer.label.min-interval', 'Min interval'),
        value: options.minInterval ?? minIntervalOnDs,
        isActive: options.minInterval != null,
      },
      {
        id: 'interval',
        label: t('query-editor.footer.label.interval', 'Interval'),
        value: realInterval ?? '-',
        isActive: false, // Interval is always computed, never user-set
      },
      {
        id: 'relativeTime',
        label: t('query-editor.footer.label.relative-time', 'Relative time'),
        value: options.timeRange?.from ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.from != null,
      },
      {
        id: 'timeShift',
        label: t('query-editor.footer.label.time-shift', 'Time shift'),
        value: options.timeRange?.shift ?? TIME_OPTION_PLACEHOLDER,
        isActive: options.timeRange?.shift != null,
      },
    ];
  }, [options, data, datasource]);

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  return (
    <div className={styles.container}>
      <ContentHeader />
      <QueryEditorBody sidebar={isSidebarOpen ? <QueryEditorDetailsSidebar onClose={handleSidebarClose} /> : undefined}>
        {/* Body content will be added here */}
      </QueryEditorBody>
      {!isSidebarOpen && (
        <QueryEditorFooter items={footerItems} onItemClick={handleOpenSidebar} onToggleSidebar={handleOpenSidebar} />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    height: '100%',
    width: '100%',
  }),
});
