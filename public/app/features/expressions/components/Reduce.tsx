import * as React from 'react';

import { CoreApp, SelectableValue } from '@grafana/data';
import { Alert, InlineField, InlineFieldRow, Input, Select, TextLink } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { ExpressionQuery, ExpressionQuerySettings, ReducerMode, reducerModes, reducerTypes } from '../types';

interface Props {
  app?: CoreApp;
  labelWidth?: number | 'auto';
  refIds: Array<SelectableValue<string>>;
  query: ExpressionQuery;
  onChange: (query: ExpressionQuery) => void;
}

export const Reduce = ({ labelWidth = 'auto', onChange, app, refIds, query }: Props) => {
  const reducer = reducerTypes.find((o) => o.value === query.reducer);

  const onRefIdChange = (value: SelectableValue<string>) => {
    onChange({ ...query, expression: value.value });
  };

  const onSelectReducer = (value: SelectableValue<string>) => {
    onChange({ ...query, reducer: value.value });
  };

  const onSettingsChanged = (settings: ExpressionQuerySettings) => {
    onChange({ ...query, settings: settings });
  };

  const onModeChanged = (value: SelectableValue<ReducerMode>) => {
    let newSettings: ExpressionQuerySettings;
    switch (value.value) {
      case ReducerMode.Strict:
        newSettings = { mode: ReducerMode.Strict };
        break;

      case ReducerMode.ReplaceNonNumbers:
        let replaceWithNumber = 0;
        if (query.settings?.mode === ReducerMode.ReplaceNonNumbers) {
          replaceWithNumber = query.settings?.replaceWithValue ?? 0;
        }
        newSettings = {
          mode: ReducerMode.ReplaceNonNumbers,
          replaceWithValue: replaceWithNumber,
        };
        break;

      default:
        newSettings = {
          mode: value.value,
        };
    }
    onSettingsChanged(newSettings);
  };

  const onReplaceWithChanged = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.valueAsNumber;
    onSettingsChanged({ mode: ReducerMode.ReplaceNonNumbers, replaceWithValue: value ?? 0 });
  };

  const mode = query.settings?.mode ?? ReducerMode.Strict;

  const replaceWithNumber = () => {
    if (mode !== ReducerMode.ReplaceNonNumbers) {
      return;
    }
    return (
      <InlineField label="Replace With" labelWidth={labelWidth}>
        <Input type="number" width={10} onChange={onReplaceWithChanged} value={query.settings?.replaceWithValue ?? 0} />
      </InlineField>
    );
  };

  // for Alerting we really don't want to add additional confusing messages that would be unhelpful to the majority of our users
  const strictModeNotification = () => {
    const isWithinAlerting = app === CoreApp.UnifiedAlerting;
    if (mode !== ReducerMode.Strict || isWithinAlerting) {
      return null;
    }

    return (
      <Alert title={t('reduce.strictMode.title', 'Strict Mode Behaviour')} severity="info">
        <Trans i18nKey="reduce.strictMode.description">
          When <code>Reduce Strict mode</code> is used, the <code>fill(null)</code> function (InfluxQL) will result in{' '}
          <code>NaN</code>.{' '}
          <TextLink href="https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries/#reduction-modes">
            See the documentation for more details.
          </TextLink>
        </Trans>
      </Alert>
    );
  };

  return (
    <>
      {strictModeNotification()}
      <InlineFieldRow>
        <InlineField label="Input" labelWidth={labelWidth}>
          <Select onChange={onRefIdChange} options={refIds} value={query.expression} width={'auto'} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Function" labelWidth={labelWidth}>
          <Select options={reducerTypes} value={reducer} onChange={onSelectReducer} width={20} />
        </InlineField>
        <InlineField label="Mode" labelWidth={labelWidth}>
          <Select onChange={onModeChanged} options={reducerModes} value={mode} width={25} />
        </InlineField>
        {replaceWithNumber()}
      </InlineFieldRow>
    </>
  );
};
