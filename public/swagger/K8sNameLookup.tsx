import { useContext, useEffect, useState } from 'react';

import { type SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { NamespaceContext, ResourceContext } from './plugins';

type Props = {
  value?: string;
  onChange: (v?: string) => void;

  // The wrapped element
  Original: React.ElementType;
  props: Record<string, unknown>;
};

export function K8sNameLookup(props: Props) {
  const [focused, setFocus] = useState(false);
  const namespace = useContext(NamespaceContext);
  const info = useContext(ResourceContext);
  const { group, version, resource, namespaced } = info ?? {};
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Array<SelectableValue<string>>>();
  const [placeholder, setPlaceholder] = useState<string>('Enter kubernetes name');

  useEffect(() => {
    setOptions(undefined);
    setLoading(false);
    setPlaceholder('Enter kubernetes name');
    if (!focused || !group || !version || !resource || (namespaced && !namespace)) {
      return;
    }

    const controller = new AbortController();
    const loadNames = async () => {
      setLoading(true);
      const url = namespaced
        ? `apis/${group}/${version}/namespaces/${namespace}/${resource}`
        : `apis/${group}/${version}/${resource}`;

      try {
        const response = await fetch(url + '?limit=100', {
          signal: controller.signal,
          headers: {
            Accept:
              'application/json;as=Table;v=v1;g=meta.k8s.io,application/json;as=Table;v=v1beta1;g=meta.k8s.io,application/json',
          },
        });
        if (!response.ok) {
          throw new Error('Error loading names');
        }
        const table = await response.json();
        if (controller.signal.aborted) {
          return;
        }
        const options: Array<SelectableValue<string>> = [];
        for (const row of table.rows ?? []) {
          const name = row.object?.metadata?.name;
          if (name) {
            options.push({ label: name, value: name });
          }
        }
        setOptions(options);
        if (!options.length) {
          setPlaceholder('No items found');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Error loading names', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    loadNames();
    return () => controller.abort();
  }, [focused, namespace, group, version, resource, namespaced]);

  if (!info) {
    return <props.Original {...props.props} />;
  }

  return (
    <Select
      allowCreateWhileLoading={true}
      allowCustomValue={true}
      placeholder={placeholder}
      loadingMessage="Loading kubernetes names..."
      formatCreateLabel={(v) => `Use: ${v}`}
      onFocus={() => setFocus(true)}
      options={options}
      isLoading={loading}
      isClearable={true}
      defaultOptions
      value={props.value ? { label: props.value, value: props.value } : undefined}
      onChange={(v: SelectableValue<string>) => props.onChange(v?.value ?? '')}
      onCreateOption={props.onChange}
    />
  );
}
