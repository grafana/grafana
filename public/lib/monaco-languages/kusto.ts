export default function loadKusto() {
  return new Worker(new URL('@kusto/monaco-kusto/release/esm/kusto.worker', import.meta.url));
}
