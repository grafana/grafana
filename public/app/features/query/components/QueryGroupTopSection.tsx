import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type GrafanaTheme2,
  type ScopedVars,
  type PanelData,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Button, InlineFormLabel, Modal, useStyles2 } from '@grafana/ui';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { type GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { type QueryGroupOptions } from 'app/types/query';

import { QueryGroupOptionsEditor } from './QueryGroupOptions';

const getStyles = (theme: GrafanaTheme2) => ({
  dataSourceRow: css({
    display: 'flex',
    marginBottom: theme.spacing(2),
  }),
  dataSourceRowItem: css({
    marginRight: theme.spacing(0.5),
  }),
  dataSourceRowItemOptions: css({
    flexGrow: 1,
    marginRight: theme.spacing(0.5),
  }),
});

interface QueryGroupTopSectionProps {
  data: PanelData;
  dataSource: DataSourceApi;
  dsSettings: DataSourceInstanceSettings;
  options: QueryGroupOptions;
  scopedVars?: ScopedVars;
  onOpenQueryInspector?: () => void;
  onOptionsChange?: (options: QueryGroupOptions) => void;
  onDataSourceChange?: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => Promise<void>;
}

export function QueryGroupTopSection({
  dataSource,
  options,
  data,
  dsSettings,
  scopedVars,
  onDataSourceChange,
  onOptionsChange,
  onOpenQueryInspector,
}: QueryGroupTopSectionProps) {
  const styles = useStyles2(getStyles);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <div data-testid={selectors.components.QueryTab.queryGroupTopSection}>
        <div className={styles.dataSourceRow}>
          <InlineFormLabel htmlFor="data-source-picker" width={'auto'}>
            <Trans i18nKey="query.query-group-top-section.data-source">Data source</Trans>
          </InlineFormLabel>
          <div className={styles.dataSourceRowItem}>
            <DataSourcePickerWithPrompt
              options={options}
              scopedVars={scopedVars}
              onChange={async (ds, defaultQueries) => {
                return await onDataSourceChange?.(ds, defaultQueries);
              }}
              isDataSourceModalOpen={Boolean(locationService.getSearchObject().firstPanel)}
            />
          </div>
          {dataSource && (
            <>
              <div className={styles.dataSourceRowItem}>
                <Button
                  variant="secondary"
                  icon="question-circle"
                  tooltip={t(
                    'query.query-group-top-section.query-tab-help-button-title-open-data-source-help',
                    'Open data source help'
                  )}
                  onClick={() => setIsHelpOpen(true)}
                  data-testid="query-tab-help-button"
                />
              </div>
              <div className={styles.dataSourceRowItemOptions}>
                <QueryGroupOptionsEditor
                  options={options}
                  dataSource={dataSource}
                  data={data}
                  onChange={(opts) => {
                    onOptionsChange?.(opts);
                  }}
                />
              </div>
              {onOpenQueryInspector && (
                <div className={styles.dataSourceRowItem}>
                  <Button
                    variant="secondary"
                    onClick={onOpenQueryInspector}
                    data-testid={selectors.components.QueryTab.queryInspectorButton}
                  >
                    <Trans i18nKey="query.query-group-top-section.query-inspector">Query inspector</Trans>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {isHelpOpen && (
        <Modal
          title={t('query.query-group-top-section.title-data-source-help', 'Data source help')}
          isOpen={true}
          onDismiss={() => setIsHelpOpen(false)}
        >
          <PluginHelp pluginId={dsSettings.meta.id} />
        </Modal>
      )}
    </>
  );
}

interface DataSourcePickerWithPromptProps {
  isDataSourceModalOpen?: boolean;
  options: QueryGroupOptions;
  scopedVars?: ScopedVars;
  onChange: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => Promise<void>;
}

function DataSourcePickerWithPrompt({ options, scopedVars, onChange, ...otherProps }: DataSourcePickerWithPromptProps) {
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(Boolean(otherProps.isDataSourceModalOpen));

  useEffect(() => {
    // Clean up the first panel flag since the modal is now open
    if (!!locationService.getSearchObject().firstPanel) {
      locationService.partial({ firstPanel: null }, true);
    }
  }, []);

  const commonProps = {
    metrics: true,
    mixed: true,
    dashboard: true,
    variables: true,
    current: options.dataSource,
    scopedVars,
    onChange: async (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => {
      await onChange(ds, defaultQueries);
      setIsDataSourceModalOpen(false);
    },
  };

  return (
    <>
      {isDataSourceModalOpen && (
        <DataSourceModal {...commonProps} onDismiss={() => setIsDataSourceModalOpen(false)}></DataSourceModal>
      )}

      <DataSourcePicker {...commonProps} />
    </>
  );
}
