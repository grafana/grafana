export default function loadKusto() {
  return new Promise<void>((resolve) =>
    __non_webpack_require__(['vs/language/kusto/monaco.contribution'], () => resolve())
  );
}
