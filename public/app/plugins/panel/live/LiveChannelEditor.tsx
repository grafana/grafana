import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import {
  LiveChannelScope,
  LiveChannelAddress,
  SelectableValue,
  StandardEditorProps,
  GrafanaTheme2,
} from '@grafana/data';
import { Select, Alert, Label, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

import { LivePanelOptions } from './types';

type Props = StandardEditorProps<Partial<LiveChannelAddress>, any, LivePanelOptions>;

const scopes: Array<SelectableValue<LiveChannelScope>> = [
  { label: 'Grafana', value: LiveChannelScope.Grafana, description: 'Core grafana live features' },
  { label: 'Data Sources', value: LiveChannelScope.DataSource, description: 'Data sources with live support' },
  { label: 'Plugins', value: LiveChannelScope.Plugin, description: 'Plugins with live support' },
  { label: 'Stream', value: LiveChannelScope.Stream, description: 'data streams (eg, influx style)' },
];

export function LiveChannelEditor(props: Props) {
  const namespaces = useMemo(() => {
    let opts: Array<SelectableValue<string>> = [];
    switch (
      props.value.scope
      // case 'x':
    ) {
    }
    return opts;
  }, [props.value.scope]);

  const paths = useMemo(() => {
    let opts: Array<SelectableValue<string>> = [];
    switch (
      props.value?.namespace
      // case 'x':
    ) {
    }
    return opts;
  }, [props.value.namespace]);

  const onScopeChanged = (v: SelectableValue<LiveChannelScope>) => {
    if (v.value) {
      props.onChange({
        scope: v.value,
        namespace: undefined,
        path: undefined,
      });
    }
  };

  const onNamespaceChanged = (v: SelectableValue<string>) => {
    props.onChange({
      scope: props.value?.scope,
      namespace: v.value,
      path: undefined,
    });
  };

  const onPathChanged = (v: SelectableValue<string>) => {
    const { value, onChange } = props;
    onChange({
      scope: value.scope,
      namespace: value.namespace,
      path: v.value,
    });
  };

  const { scope, namespace, path } = props.value;
  const style = getStyles(config.theme2);

  return (
    <>
      <Alert title="Grafana Live" severity="info">
        This supports real-time event streams in grafana core. This feature is under heavy development. Expect the
        intefaces and structures to change as this becomes more production ready.
      </Alert>

      <div>
        <div className={style.dropWrap}>
          <Label>Scope</Label>
          <Select options={scopes} value={scopes.find((s) => s.value === scope)} onChange={onScopeChanged} />
        </div>

        {scope && (
          <div className={style.dropWrap}>
            <Label>Namespace</Label>
            <Select
              options={namespaces}
              value={
                namespaces.find((s) => s.value === namespace) ??
                (namespace ? { label: namespace, value: namespace } : undefined)
              }
              onChange={onNamespaceChanged}
              allowCustomValue={true}
              backspaceRemovesValue={true}
              isClearable={true}
            />
          </div>
        )}

        {scope && namespace && (
          <div className={style.dropWrap}>
            <Label>Path</Label>
            <Select
              options={paths}
              value={findPathOption(paths, path)}
              onChange={onPathChanged}
              allowCustomValue={true}
              backspaceRemovesValue={true}
              isClearable={true}
            />
          </div>
        )}
      </div>
    </>
  );
}

function findPathOption(paths: Array<SelectableValue<string>>, path?: string): SelectableValue<string> | undefined {
  const v = paths.find((s) => s.value === path);
  if (v) {
    return v;
  }
  if (path) {
    return { label: path, value: path };
  }
  return undefined;
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  dropWrap: css`
    margin-bottom: ${theme.spacing(1)};
  `,
}));
