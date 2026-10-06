import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';
import { useId } from 'react';

import { type PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { PanelDataErrorView } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { useLinks } from '../../../features/explore/utils/links';

import { NodeGraph } from './NodeGraph';
import { type Options as NodeGraphOptions } from './panelcfg.gen';
import { getNodeGraphDataFrames } from './utils';

export const NodeGraphPanel = ({ id, width, height, data, fieldConfig, options }: PanelProps<NodeGraphOptions>) => {
  const styles = useStyles2(getStyles);
  const getLinks = useLinks(data.timeRange);
  const panelId = useId();

  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>
          <Trans i18nKey="nodeGraph.node-graph-panel.no-data-found-in-response">No data found in response</Trans>
        </p>
      </div>
    );
  }

  const memoizedGetNodeGraphDataFrames = memoizeOne(getNodeGraphDataFrames);
  return (
    <div style={{ width, height }}>
      <NodeGraph
        dataFrames={memoizedGetNodeGraphDataFrames(data.series, options)}
        getLinks={getLinks}
        panelId={panelId}
        zoomMode={options.zoomMode}
        layoutAlgorithm={options.layoutAlgorithm}
        renderError={(message) => (
          <div className={styles.errorWrapper}>
            <PanelDataErrorView panelId={id} data={data} fieldConfig={fieldConfig} message={message} />
          </div>
        )}
      />
    </div>
  );
};

const getStyles = () => ({
  errorWrapper: css({
    height: '100%',
    whiteSpace: 'pre-line',
  }),
});
