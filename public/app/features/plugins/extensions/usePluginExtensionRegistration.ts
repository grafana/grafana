import { useMemo } from 'react';
import { catchError, combineLatest, defer, distinctUntilChanged, map, of, startWith } from 'rxjs';

import { type AppPluginConfig } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { getAppPluginMetas } from '@grafana/runtime/internal';
import {
  type PluginExtensionRegistrationState,
  type PluginExtensionRegistrationTarget,
} from '@grafana/runtime/unstable';

import {
  useAddedComponentsRegistry,
  useAddedFunctionsRegistry,
  useAddedLinksRegistry,
  useExposedComponentsRegistry,
} from './ExtensionRegistriesContext';
import { pluginLoadStates } from './pluginLoadState';

type ExtensionMetadata = { apps?: AppPluginConfig[]; error?: Error };

const UNKNOWN: PluginExtensionRegistrationState = { status: 'unknown' };

export function usePluginExtensionRegistration(
  target: PluginExtensionRegistrationTarget
): PluginExtensionRegistrationState {
  const components = useAddedComponentsRegistry();
  const links = useAddedLinksRegistry();
  const functions = useAddedFunctionsRegistry();
  const exposed = useExposedComponentsRegistry();
  const { kind } = target;
  const pluginId = kind === 'exposed-component' ? target.id.split('/')[0] : target.pluginId;
  const id = kind === 'exposed-component' ? target.id : target.extensionPointId;
  const title = kind === 'exposed-component' ? undefined : target.title;

  const key = JSON.stringify([kind, pluginId, id, title]);
  const observable = useMemo(() => {
    const matches = (items: Array<{ pluginId: string; title: string }> | undefined) =>
      (items ?? []).some((item) => item.pluginId === pluginId && item.title === title);
    const registered =
      kind === 'exposed-component'
        ? exposed.asObservableSlice((state) => state[id]).pipe(map((item) => item?.pluginId === pluginId))
        : kind === 'component'
          ? components.asObservableSlice((state) => state[id]).pipe(map(matches))
          : kind === 'link'
            ? links.asObservableSlice((state) => state[id]).pipe(map(matches))
            : functions.asObservableSlice((state) => state[id]).pipe(map(matches));
    return combineLatest({
      metadata: defer(getAppPluginMetas).pipe(
        map((apps): ExtensionMetadata => ({ apps })),
        catchError((error: unknown) =>
          of<ExtensionMetadata>({
            error: error instanceof Error ? error : new Error(String(error)),
          })
        ),
        startWith<ExtensionMetadata>({})
      ),
      registered,
      loads: pluginLoadStates,
    }).pipe(
      map((snapshot): PluginExtensionRegistrationState => {
        if (snapshot.registered) {
          return { status: 'ready' };
        }
        if (snapshot.metadata.error) {
          return { status: 'failed', error: snapshot.metadata.error };
        }
        if (!snapshot.metadata.apps) {
          return UNKNOWN;
        }
        const extensions = snapshot.metadata.apps.find((app) => app.id === pluginId)?.extensions;
        const declared =
          kind === 'exposed-component'
            ? extensions?.exposedComponents.some((item) => item.id === id)
            : extensions?.[
                kind === 'component' ? 'addedComponents' : kind === 'link' ? 'addedLinks' : 'addedFunctions'
              ].some((item) => item.title === title && item.targets.includes(id));
        if (!declared) {
          return { status: 'absent' };
        }
        const load = snapshot.loads.get(pluginId);
        if (load?.status === 'failed') {
          return load;
        }
        if (load?.status === 'loaded') {
          return {
            status: 'failed',
            error: new Error(`Plugin "${pluginId}" did not register the declared extension "${id}".`),
          };
        }
        return { status: load?.status === 'loading' ? 'loading' : 'declared' };
      }),
      startWith(UNKNOWN),
      distinctUntilChanged(
        (previous, current) =>
          previous.status === current.status &&
          (previous.status !== 'failed' ||
            current.status !== 'failed' ||
            previous.error.message === current.error.message)
      ),
      map((state) => ({ key, state }))
    );
  }, [components, links, functions, exposed, kind, pluginId, id, title, key]);

  const result = useObservable(observable);
  return result?.key === key ? result.state : UNKNOWN;
}
