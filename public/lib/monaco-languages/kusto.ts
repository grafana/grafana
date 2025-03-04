import kustoWorkerUrl from '@kusto/monaco-kusto/release/esm/kusto.worker?worker&url';

export default function loadKusto() {
  return kustoWorkerUrl;
}
