// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/NestedQuery.tsx
import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2, toOption } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { EditorRows, FlexItem } from '@grafana/plugin-ui';
import { AutoSizeInput, IconButton, Select, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { binaryScalarDefs } from '../binaryScalarOperations';
import { PromVisualQueryBinary } from '../types';

import { QueryBuilderContent } from './QueryBuilderContent';

interface NestedQueryProps {
  nestedQuery: PromVisualQueryBinary;
  datasource: PrometheusDatasource;
  index: number;
  onChange: (index: number, update: PromVisualQueryBinary) => void;
  onRemove: (index: number) => void;
  onRunQuery: () => void;
  showExplain: boolean;
}

export const NestedQuery = memo<NestedQueryProps>((props) => {
  const { nestedQuery, index, datasource, onChange, onRemove, onRunQuery, showExplain } = props;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.name}>
          <Trans i18nKey="grafana-prometheus.querybuilder.nested-query.operator">Operator</Trans>
        </div>
        <Select
          width="auto"
          options={operators}
          value={toOption(nestedQuery.operator)}
          onChange={(value) => {
            onChange(index, {
              ...nestedQuery,
              operator: value.value!,
            });
          }}
        />
        <div className={styles.name}>
          <Trans i18nKey="grafana-prometheus.querybuilder.nested-query.vector-matches">Vector matches</Trans>
        </div>
        <div className={styles.vectorMatchWrapper}>
          <Select<PromVisualQueryBinary['vectorMatchesType']>
            width="auto"
            value={nestedQuery.vectorMatchesType || 'on'}
            allowCustomValue
            options={[
              { value: 'on', label: t('grafana-prometheus.querybuilder.nested-query.label.on', 'On') },
              {
                value: 'ignoring',
                label: t('grafana-prometheus.querybuilder.nested-query.label.ignoring', 'Ignoring'),
              },
            ]}
            onChange={(val) => {
              onChange(index, {
                ...nestedQuery,
                vectorMatchesType: val.value,
              });
            }}
          />
          <AutoSizeInput
            className={styles.vectorMatchInput}
            minWidth={20}
            defaultValue={nestedQuery.vectorMatches}
            onCommitChange={(evt) => {
              onChange(index, {
                ...nestedQuery,
                vectorMatches: evt.currentTarget.value,
                vectorMatchesType: nestedQuery.vectorMatchesType || 'on',
              });
            }}
          />
        </div>
        <FlexItem grow={1} />
        <IconButton
          name="times"
          size="sm"
          onClick={() => onRemove(index)}
          tooltip={t('grafana-prometheus.querybuilder.nested-query.tooltip-remove-match', 'Remove match')}
        />
      </div>
      <div className={styles.body}>
        <EditorRows>
          <QueryBuilderContent
            showExplain={showExplain}
            query={nestedQuery.query}
            datasource={datasource}
            onRunQuery={onRunQuery}
            onChange={(update) => {
              onChange(index, { ...nestedQuery, query: update });
            }}
          />
        </EditorRows>
      </div>
    </div>
  );
});

const operators = binaryScalarDefs.map((def) => ({ label: def.sign, value: def.sign }));

NestedQuery.displayName = 'NestedQuery';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      label: 'card',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    header: css({
      label: 'header',
      padding: theme.spacing(0.5, 0.5, 0.5, 1),
      gap: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    }),
    name: css({
      label: 'name',
      whiteSpace: 'nowrap',
    }),
    body: css({
      label: 'body',
      paddingLeft: theme.spacing(2),
    }),
    vectorMatchInput: css({
      label: 'vectorMatchInput',
      marginLeft: -1,
    }),
    vectorMatchWrapper: css({
      label: 'vectorMatchWrapper',
      display: 'flex',
    }),
  };
};
