import React, { useState } from 'react';
import { css } from '@emotion/css';
import { DataSourceInstanceSettings, GrafanaTheme2, LoadingState, PanelData, urlUtil } from '@grafana/data';
import { getDataSourceSrv, PanelRenderer } from '@grafana/runtime';
import { PanelChrome, useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';
import { AlertQuery } from 'app/types/unified-alerting-dto';
import { AlertingQueryRunner } from '../../state/AlertingQueryRunner';
import { SupportedPanelPlugins } from '../rule-editor/QueryWrapper';
import { VisualizationSelector } from './VisualizationSelector';
import AutoSizer from 'react-virtualized-auto-sizer';

type AlertQueryVisualizationProps = {
  data?: PanelData;
  defaultPanel?: SupportedPanelPlugins;
  query: AlertQuery;
  runner: AlertingQueryRunner;
};

export function AlertQueryVisualization(props: AlertQueryVisualizationProps): JSX.Element | null {
  const styles = useStyles2(getStyles);
  const { data, defaultPanel = 'timeseries', query, runner } = props;
  const [panel, setPanel] = useState<SupportedPanelPlugins>(defaultPanel);
  const dsSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });

  if (!data || !dsSettings) {
    return null;
  }

  return (
    <div className={styles.content2}>
      <AutoSizer>
        {({ width, height }) => (
          <PanelChrome
            width={width}
            height={height}
            title={`${query.refId} (${dsSettings.name})`}
            leftItems={[
              <VisualizationSelector key="visualization-selector" value={panel} onSelect={setPanel} />,
              <PanelChrome.ExternalLink
                title="Open in explore"
                href={createExploreLink(dsSettings, query)}
                key="explore-link"
                visible={!isExpressionQuery(query.model)}
              />,
              <PanelChrome.LoadingIndicator
                key="loading-indicator"
                loading={data.state === LoadingState.Loading}
                onCancel={() => runner.cancel()}
              />,
            ]}
          >
            {(innerWidth, innerHeight) => (
              <div className={styles.innerContent}>
                <PanelRenderer
                  height={innerHeight}
                  width={innerWidth}
                  data={data}
                  pluginId={panel}
                  title=""
                  onOptionsChange={setOptions}
                  options={options}
                />
              </div>
            )}
          </PanelChrome>
        )}
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
    innerContent: css``,
    content2: css`
      width: 100%;
      height: 250px;
    `,
    wrapper: css`
      margin-bottom: ${theme.spacing(2)};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.borderRadius(1)};
      padding-bottom: ${theme.spacing(1)};
    `,
    header: css`
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      border-radius: 2px;
      background: ${theme.v1.colors.bg2};
      min-height: ${theme.spacing(4)};
      display: flex;
      align-items: center;
      justify-content: space-between;
      white-space: nowrap;

      &:focus {
        outline: none;
      }
    `,
    content: css`
      padding: ${theme.spacing(2)};
    `,
    refId: css`
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.link};
      overflow: hidden;
    `,
    datasource: css`
      margin-left: ${theme.spacing(2)};
      font-style: italic;
    `,
  };
};
