import React, { useState } from 'react';

import { DataSourceRef, LiveChannelScope, SelectableValue } from '@grafana/data';
import { DataSourcePicker, getBackendSrv } from '@grafana/runtime';
import { Input, Field, Button, ValuePicker, HorizontalGroup } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import { Rule } from './types';

interface Props {
  onRuleAdded: (rule: Rule) => void;
}

type PatternType = 'ds' | 'any';

const patternTypes: Array<SelectableValue<PatternType>> = [
  {
    label: 'Data source',
    description: 'Configure a channel scoped to a data source instance',
    value: 'ds',
  },
  {
    label: 'Any',
    description: 'Enter an arbitray channel pattern',
    value: 'any',
  },
];

export function AddNewRule({ onRuleAdded }: Props) {
  const [patternType, setPatternType] = useState<PatternType>();
  const [pattern, setPattern] = useState<string>();
  const [patternPrefix, setPatternPrefix] = useState<string>('');
  const [datasource, setDatasource] = useState<DataSourceRef>();
  const notifyApp = useAppNotification();

  const onSubmit = () => {
    if (!pattern) {
      notifyApp.error('Enter path');
      return;
    }
    if (patternType === 'ds' && !patternPrefix.length) {
      notifyApp.error('Select datasource');
      return;
    }

    getBackendSrv()
      .post(`api/live/channel-rules`, {
        pattern: patternPrefix + pattern,
        settings: {
          converter: {
            type: 'jsonAuto',
          },
          frameOutputs: [
            {
              type: 'managedStream',
            },
          ],
        },
      })
      .then((v: any) => {
        console.log('ADDED', v);
        setPattern(undefined);
        setPatternType(undefined);
        onRuleAdded(v.rule);
      })
      .catch((e) => {
        notifyApp.error('Error adding rule', e);
        e.isHandled = true;
      });
  };

  if (patternType) {
    return (
      <div>
        <HorizontalGroup>
          {patternType === 'any' && (
            <Field label="Pattern">
              <Input
                value={pattern ?? ''}
                onChange={(e) => setPattern(e.currentTarget.value)}
                placeholder="scope/namespace/path"
              />
            </Field>
          )}
          {patternType === 'ds' && (
            <>
              <Field label="Data source">
                <DataSourcePicker
                  current={datasource}
                  onChange={(ds) => {
                    setDatasource(ds);
                    setPatternPrefix(`${LiveChannelScope.DataSource}/${ds.uid}/`);
                  }}
                />
              </Field>
              <Field label="Path">
                <Input value={pattern ?? ''} onChange={(e) => setPattern(e.currentTarget.value)} placeholder="path" />
              </Field>
            </>
          )}

          <Field label="">
            <Button onClick={onSubmit} variant={pattern?.length ? 'primary' : 'secondary'}>
              Add
            </Button>
          </Field>

          <Field label="">
            <Button variant="secondary" onClick={() => setPatternType(undefined)}>
              Cancel
            </Button>
          </Field>
        </HorizontalGroup>
      </div>
    );
  }

  return (
    <div>
      <ValuePicker
        label="Add channel rule"
        variant="secondary"
        size="md"
        icon="plus"
        menuPlacement="auto"
        isFullWidth={false}
        options={patternTypes}
        onChange={(v) => setPatternType(v.value)}
      />
    </div>
  );
}
