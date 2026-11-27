import { type PropsWithChildren, useContext, useMemo, useState } from 'react';

import { type ComponentDescriptor, type ComponentHostAdapter } from '@grafana/data';
import { isRecord } from 'app/core/utils/isRecord';

import { useDescriptorState } from '../../ComponentDescriptorsContext';
import { FunctionExtensionTransformsContext } from '../../ExtensionRegistriesContext';
import { type AddedFunctionsRegistryItem } from '../../registry/AddedFunctionsRegistry';
import { useRegisterComponentHostAdapter } from '../../useRegisterComponentHostAdapter';

import { CatalogReply, type InlineReplyProps } from './CatalogReply';

export const ASSISTANT_EXTENSION_POINT = 'grafana-assistant-app/extension/v1';
const title = 'assistant-extension';

function catalogChit(entry: ComponentDescriptor) {
  // The host prefixes the provider ID and only accepts lowercase letters and digits in the suffix.
  const suffix = entry.id.slice(entry.pluginId.length + 1);
  const name =
    'catalog' + Array.from(new TextEncoder().encode(suffix), (b) => b.toString(16).padStart(2, '0')).join('');
  return {
    kind: 'inline',
    name,
    prompt: `Use <${entry.pluginId.replace(/[^a-z0-9]+/gi, '_')}_${name} />. ${entry.prompt}`,
    selfClosing: true,
    display: 'block',
    component: (reply: InlineReplyProps) => <CatalogReply componentId={entry.id} reply={reply} />,
  };
}

interface Registration {
  pluginId: string;
  chit: ReturnType<typeof catalogChit>;
}

export function AssistantAdapterProvider({ children }: PropsWithChildren) {
  const { loading } = useDescriptorState();
  const parentTransforms = useContext(FunctionExtensionTransformsContext);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const adapter = useMemo<ComponentHostAdapter>(
    () => ({
      supports: (entry) => entry.version === 'v1',
      register(entry) {
        const item = { pluginId: entry.pluginId, chit: catalogChit(entry) };
        setRegistrations((items) => [...items, item]);
        return () => setRegistrations((items) => items.filter((existing) => existing !== item));
      },
    }),
    []
  );
  useRegisterComponentHostAdapter(adapter);
  const transforms = useMemo(
    () =>
      new Map(parentTransforms).set(ASSISTANT_EXTENSION_POINT, {
        isLoading: loading,
        apply: (items) => withAssistantContributions(items, registrations),
      }),
    [parentTransforms, registrations, loading]
  );
  return (
    <FunctionExtensionTransformsContext.Provider value={transforms}>
      {children}
    </FunctionExtensionTransformsContext.Provider>
  );
}

function appendChits(manifest: unknown, chits: Registration['chit'][]) {
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== 1 ||
    (manifest.chits !== undefined && !Array.isArray(manifest.chits))
  ) {
    return manifest;
  }
  const existing = manifest.chits ?? [];
  const names = new Set(
    existing.flatMap((chit: unknown) => (isRecord(chit) && chit.kind === 'inline' ? [chit.name] : []))
  );
  return { ...manifest, chits: [...existing, ...chits.filter((chit) => !names.has(chit.name))] };
}

function withAssistantContributions<Signature>(
  items: Array<AddedFunctionsRegistryItem<Signature>>,
  registrations: Registration[]
) {
  if (!registrations.length) {
    return items;
  }
  const byProvider = new Map<string, Registration['chit'][]>();
  for (const { pluginId, chit } of registrations) {
    const group = byProvider.get(pluginId);
    if (group) {
      group.push(chit);
    } else {
      byProvider.set(pluginId, [chit]);
    }
  }
  const merged = items.map((item) => {
    const chits = byProvider.get(item.pluginId);
    if (!chits || typeof item.fn !== 'function') {
      return item;
    }
    byProvider.delete(item.pluginId);
    const fn = item.fn;
    return { ...item, fn: assistantFunction<Signature>(() => appendChits(fn(), chits)) };
  });
  for (const [pluginId, chits] of byProvider) {
    merged.push({ pluginId, title, fn: assistantFunction<Signature>(() => ({ schemaVersion: 1, chits })) });
  }
  return merged;
}

function assistantFunction<Signature>(fn: () => unknown): Signature {
  // The consumer supplies Signature; only the Assistant v1 extension point receives these callbacks.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return fn as Signature;
}
