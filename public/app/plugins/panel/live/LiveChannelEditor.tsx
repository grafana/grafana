import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import {
  LiveChannelScope,
  LiveChannelAddress,
  SelectableValue,
  StandardEditorProps,
  GrafanaTheme2,
  parseLiveChannelAddress,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Select, Alert, Label, stylesFactory, Combobox } from '@grafana/ui';
import { config } from 'app/core/config';
import { discoveryResources, getAPIGroupDiscoveryList, GroupDiscoveryResource } from 'app/features/apiserver/discovery';
import { getManagedChannelInfo } from 'app/features/live/info';

import { LivePanelOptions } from './types';

type Props = StandardEditorProps<Partial<LiveChannelAddress>, {}, LivePanelOptions>;

const scopes: Array<SelectableValue<LiveChannelScope>> = [
  { label: 'Grafana', value: LiveChannelScope.Grafana, description: 'Core grafana live features' },
  { label: 'Data Sources', value: LiveChannelScope.DataSource, description: 'Data sources with live support' },
  { label: 'Plugins', value: LiveChannelScope.Plugin, description: 'Plugins with live support' },
  { label: 'Stream', value: LiveChannelScope.Stream, description: 'data streams (eg, influx style)' },
  { label: 'Watch', value: LiveChannelScope.Watch, description: 'Watch k8s style resources' },
];

export function LiveChannelEditor(props: Props) {
  const [channels, setChannels] = useState<Array<SelectableValue<string>>>([]);
  const [namespaces, paths] = useMemo(() => {
    const namespaces: Array<SelectableValue<string>> = [];
    const paths: Array<SelectableValue<string>> = [];
    const scope = props.value.scope;
    const namespace = props.value.namespace;
    if (!scope?.length) {
      return [namespaces, paths];
    }
    const used: Record<string, boolean> = {};

    for (let channel of channels) {
      const addr = parseLiveChannelAddress(channel.value);
      if (!addr || addr.scope !== scope) {
        continue;
      }

      if (!used[addr.namespace]) {
        namespaces.push({
          value: addr.namespace,
          label: addr.namespace,
        });
        used[addr.namespace] = true;
      }

      if (namespace?.length && namespace === addr.namespace) {
        paths.push({
          ...channel,
          value: addr.path,
        });
      }
    }
    return [namespaces, paths];
  }, [channels, props.value.scope, props.value.namespace]);

  useEffect(() => {
    getManagedChannelInfo().then((v) => {
      setChannels(v.channels);
    });
  }, [props.value.scope]);

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
      namespace: v?.value,
      path: undefined,
    });
  };

  const onPathChanged = (v: SelectableValue<string>) => {
    const { value, onChange } = props;
    onChange({
      scope: value.scope,
      namespace: value.namespace,
      path: v?.value,
    });
  };

  const getWatchableResources = async (v: string) => {
    const apis = await getAPIGroupDiscoveryList();
    return discoveryResources(apis)
      .filter((v) => v.verbs.includes('watch'))
      .map((r) => ({
        value: `${r.responseKind.group}/${r.responseKind.version}/${r.resource}`, // must be string | number
        resource: r,
      }));
  };

  const { scope, namespace, path } = props.value;
  const style = getStyles(config.theme2);

  return (
    <>
      <Alert title={t('live.live-channel-editor.title-grafana-live', 'Grafana Live')} severity="info">
        <Trans i18nKey="live.live-channel-editor.description-grafana-live">
          This supports real-time event streams in Grafana core. This feature is under heavy development. Expect the
          interfaces and structures to change as this becomes more production ready.
        </Trans>
      </Alert>

      <div>
        <div className={style.dropWrap}>
          <Label>
            <Trans i18nKey="live.live-channel-editor.scope">Scope</Trans>
          </Label>
          <Select options={scopes} value={scopes.find((s) => s.value === scope)} onChange={onScopeChanged} />
        </div>

        {scope === LiveChannelScope.Watch && (
          <div className={style.dropWrap}>
            <Combobox
              options={getWatchableResources}
              placeholder={t(
                'live.live-channel-editor.placeholder-select-watchable-resource',
                'Select watchable resource'
              )}
              onChange={(v) => {
                const resource = (v as any).resource as GroupDiscoveryResource;
                if (resource) {
                  props.onChange({
                    scope: LiveChannelScope.Watch,
                    namespace: resource.responseKind.group,
                    path: `${resource.responseKind.version}/${resource.resource}/${config.bootData.user.uid}`, // only works for this user
                  });
                }
              }}
            />
          </div>
        )}

        {scope && (
          <div className={style.dropWrap}>
            <Label>
              <Trans i18nKey="live.live-channel-editor.namespace">Namespace</Trans>
            </Label>
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
            <Label>
              <Trans i18nKey="live.live-channel-editor.path">Path</Trans>
            </Label>
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
  dropWrap: css({
    marginBottom: theme.spacing(1),
  }),
}));
