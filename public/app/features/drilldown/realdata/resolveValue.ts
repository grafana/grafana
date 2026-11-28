const EBPF = 'ebpf/';

// The namespace in front of a service in a value such as <namespace>/<service> or ebpf/<namespace>/<service>.
const namespaceOf = (value: string, suffix: string) => value.slice(0, -suffix.length).replace(/^ebpf\//, '');

// Logs and profiles name a service from what their agents find in Kubernetes, so the name Tempo holds can sit behind a
// namespace there. A value counts when it equals the name, or when it puts a namespace that Tempo lists for the service
// in front of the name.
export async function resolveValue(
  service: string,
  values: string[],
  namespacesOf: () => Promise<string[]>
): Promise<string | undefined> {
  if (values.includes(service)) {
    return service;
  }
  const suffix = `/${service}`;
  const prefixed = values.filter((value) => value.endsWith(suffix));
  if (prefixed.length === 0) {
    return undefined;
  }
  const namespaces = await namespacesOf();
  const listed = prefixed.filter((value) => namespaces.includes(namespaceOf(value, suffix)));
  // An eBPF value covers pods that an SDK value already counts, so the SDK value stands alone when both exist.
  const sdk = listed.filter((value) => !value.startsWith(EBPF));
  return (sdk.length > 0 ? sdk : listed)[0];
}
