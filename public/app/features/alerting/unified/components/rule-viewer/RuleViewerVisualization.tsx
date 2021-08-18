import React, { useState } from 'react';
import { css } from '@emotion/css';
import { DataSourceInstanceSettings, GrafanaTheme2, PanelData, urlUtil } from '@grafana/data';
import { getDataSourceSrv, PanelRenderer } from '@grafana/runtime';
import { Alert, CodeEditor, LinkButton, useStyles2, useTheme2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';
import { AlertQuery } from 'app/types/unified-alerting-dto';
import AutoSizer from 'react-virtualized-auto-sizer';
import { PanelPluginsButtonGroup, SupportedPanelPlugins } from '../PanelPluginsButtonGroup';
import { TABLE, TIMESERIES } from '../../utils/constants';

type RuleViewerVisualizationProps = {
  data?: PanelData;
  query: AlertQuery;
};

const headerHeight = 4;

export function RuleViewerVisualization(props: RuleViewerVisualizationProps): JSX.Element | null {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { data, query } = props;
  const defaultPanel = isExpressionQuery(query.model) ? TABLE : TIMESERIES;
  const [panel, setPanel] = useState<SupportedPanelPlugins>(defaultPanel);
  const dsSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });

  if (!data) {
    return null;
  }

  if (!dsSettings) {
    return (
      <div className={styles.content}>
        <Alert title="Could not find datasource for query" />
        <CodeEditor
          width="100%"
          height="250px"
          language="json"
          showLineNumbers={false}
          showMiniMap={false}
          value={JSON.stringify(query, null, '\t')}
          readOnly={true}
        />
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <AutoSizer>
        {({ width, height }) => {
          return (
            <div style={{ width, height }}>
              <div className={styles.header}>
                <div>
                  {`Query ${query.refId}`}
                  <span className={styles.dataSource}>({dsSettings.name})</span>
                </div>
                <div className={styles.actions}>
                  <PanelPluginsButtonGroup onChange={setPanel} value={panel} size="sm" />
                  {!isExpressionQuery(query.model) && (
                    <>
                      <div className={styles.spacing} />
                      <LinkButton
                        size="sm"
                        variant="secondary"
                        icon="compass"
                        target="_blank"
                        href={createExploreLink(dsSettings, query)}
                      >
                        View in Explore
                      </LinkButton>
                    </>
                  )}
                </div>
              </div>
              <PanelRenderer
                height={height - theme.spacing.gridSize * headerHeight}
                width={width}
                data={data}
                pluginId={panel}
                title=""
                onOptionsChange={setOptions}
                options={options}
              />
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
}

function createExploreLink(settings: DataSourceInstanceSettings, query: AlertQuery): string {
  const { name } = settings;
  const { refId, ...rest } = query.model;
  const queryParams = { ...rest, datasource: name };

  return urlUtil.renderUrl('/explore', {
    left: JSON.stringify(['now-1h', 'now', name, queryParams]),
  });
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    content: css`
      width: 100%;
      height: 250px;
    `,
    header: css`
      height: ${theme.spacing(headerHeight)};
      display: flex;
      align-items: center;
      justify-content: space-between;
      white-space: nowrap;
    `,
    refId: css`
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.link};
      overflow: hidden;
    `,
    dataSource: css`
      margin-left: ${theme.spacing(1)};
      font-style: italic;
      color: ${theme.colors.text.secondary};
    `,
    actions: css`
      display: flex;
      align-items: center;
    `,
    spacing: css`
      padding: ${theme.spacing(0, 1, 0, 0)};
    `,
    errorMessage: css`
      white-space: pre-wrap;
    `,
  };
};
