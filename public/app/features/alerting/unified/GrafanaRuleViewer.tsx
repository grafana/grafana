import { css } from '@emotion/css';
import { dump } from 'js-yaml';
import { keyBy } from 'lodash';
import Prism from 'prismjs';
import React, { useEffect } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data/src';
import { config } from '@grafana/runtime/src';
import { useStyles2 } from '@grafana/ui/src';
import { mapRelativeTimeRangeToOption } from '@grafana/ui/src/components/DateTimePickers/RelativeTimeRangePicker/utils';

import { AlertQuery, RulerGrafanaRuleDTO } from '../../../types/unified-alerting-dto';
import { ClassicConditions } from '../../expressions/components/ClassicConditions';
import { Math } from '../../expressions/components/Math';
import { Reduce } from '../../expressions/components/Reduce';
import { Resample } from '../../expressions/components/Resample';
import { Threshold } from '../../expressions/components/Threshold';
import { isExpressionQuery } from '../../expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from '../../expressions/types';

export function GrafanaRuleViewer({ rule }: { rule: RulerGrafanaRuleDTO }) {
  const styles = useStyles2(getGrafanaRuleViewerStyles);

  const dsByUid = keyBy(Object.values(config.datasources), (ds) => ds.uid);

  useEffect(() => {
    Prism.highlightAll();
  });

  return (
    <div>
      <h2>Grafana Rule Preview</h2>
      {rule.grafana_alert.data.map(({ model, relativeTimeRange, refId, datasourceUid }, index) => {
        const dataSource = dsByUid[datasourceUid];

        if (isExpressionQuery(model)) {
          return <ExpressionPreview key={index} refId={refId} model={model} dataSource={dataSource} />;
        }

        return (
          <QueryPreview
            key={index}
            refId={refId}
            model={model}
            relativeTimeRange={relativeTimeRange}
            dataSource={dataSource}
          />
        );
      })}
    </div>
  );
}

const getGrafanaRuleViewerStyles = (theme: GrafanaTheme2) => ({});

interface QueryPreviewProps extends Pick<AlertQuery, 'refId' | 'relativeTimeRange' | 'model'> {
  dataSource?: DataSourceInstanceSettings;
}

function QueryPreview({ refId, relativeTimeRange, model, dataSource }: QueryPreviewProps) {
  const styles = useStyles2(getQueryPreviewStyles);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.refId}>{refId}</span>
        <span className={styles.textBlock}>{dataSource?.name ?? '[[Data source not found]]'}</span>
        {relativeTimeRange && (
          <span className={styles.textBlock}>{mapRelativeTimeRangeToOption(relativeTimeRange).display}</span>
        )}
      </header>
      <pre>
        <code>{dump(model)}</code>
      </pre>
    </div>
  );
}

const getQueryPreviewStyles = (theme: GrafanaTheme2) => ({
  container: css`
    border: 1px solid ${theme.colors.border.strong};
  `,
  header: css`
    display: flex;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.secondary};
  `,
  textBlock: css`
    border: 1px solid ${theme.colors.border.weak};
    padding: ${theme.spacing(0.5, 1)};
    background-color: ${theme.colors.background.primary};
  `,
  refId: css`
    color: ${theme.colors.text.link};
    padding: ${theme.spacing(0.5, 1)};
    border: 1px solid ${theme.colors.border.weak};
  `,
});

interface ExpressionPreviewProps extends Pick<AlertQuery, 'refId'> {
  model: ExpressionQuery;
  dataSource: DataSourceInstanceSettings;
}

function ExpressionPreview({ refId, model }: ExpressionPreviewProps) {
  function renderPreview() {
    switch (model.type) {
      case ExpressionQueryType.math:
        return <div>Math</div>;

      case ExpressionQueryType.reduce:
        return <div>Reduce</div>;

      case ExpressionQueryType.resample:
        return <div>Resample</div>;

      case ExpressionQueryType.classic:
        return <div>Classic</div>;

      case ExpressionQueryType.threshold:
        return <div>Threshold</div>;

      default:
        return <>Expression not supported: {model.type}</>;
    }
  }

  return (
    <div>
      {refId} [{model.type}]
      <pre>
        <code>{dump(model)}</code>
      </pre>
    </div>
  );
}
