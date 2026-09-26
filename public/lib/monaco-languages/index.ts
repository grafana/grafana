import loadKusto from './kusto';

export default function getDefaultMonacoLanguages() {
  const kusto = {
    id: 'kusto',
    name: 'kusto',
    init: loadKusto,
    editorOptions: { 'semanticHighlighting.enabled': true },
  };
  return [kusto];
}
