import { css } from '@emotion/css';
import * as React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { FieldConfigSource, FieldMatcherID, GrafanaTheme2, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { TableCellDisplayMode, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { PreviewRuleResponse } from '../../types/preview';
import { RuleFormType } from '../../types/rule-form';
import { messageFromError } from '../../utils/redux';

type Props = {
  preview: PreviewRuleResponse | undefined;
};

export function PreviewRuleResult(props: Props): React.ReactElement | null {
  const { preview } = props;
  const styles = useStyles2(getStyles);
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [
      {
        matcher: { id: FieldMatcherID.byName, options: 'Info' },
        properties: [{ id: 'custom.displayMode', value: TableCellDisplayMode.JSONView }],
      },
    ],
  };

  if (!preview) {
    return null;
  }

  const { data, ruleType } = preview;

  if (data.state === LoadingState.Loading) {
    return (
      <div className={styles.container}>
        <span>
          <Trans i18nKey="alerting.preview-rule-result.loading-preview">Loading preview...</Trans>
        </span>
      </div>
    );
  }

  if (data.state === LoadingState.Error) {
    return (
      <div className={styles.container}>
        {data.error
          ? messageFromError(data.error)
          : t('alerting.preview-rule-result.preview-failed', 'Failed to preview alert rule')}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Trans i18nKey="alerting.preview-rule-result.preview-based-on-query-result">
        Preview based on the result of running the query, for this moment.
      </Trans>
      {ruleType === RuleFormType.grafana && (
        <Trans i18nKey="alerting.preview-rule-result.no-data-error-handling-not-applied">
          Configuration for `no data` and `error handling` is not applied.
        </Trans>
      )}
      <div className={styles.table}>
        <AutoSizer>
          {({ width, height }) => (
            <div style={{ width: `${width}px`, height: `${height}px` }}>
              <PanelRenderer
                title=""
                width={width}
                height={height}
                pluginId="table"
                data={data}
                fieldConfig={fieldConfig}
              />
            </div>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      margin: `${theme.spacing(2)} 0`,
    }),
    table: css({
      flex: '1 1 auto',
      height: '135px',
      marginTop: theme.spacing(2),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    }),
  };
}
