import loadKusto from './kusto';
export default function getDefaultMonacoLanguages() {
    const kusto = { id: 'kusto', name: 'kusto', init: loadKusto };
    return [kusto];
}
//# sourceMappingURL=index.js.map