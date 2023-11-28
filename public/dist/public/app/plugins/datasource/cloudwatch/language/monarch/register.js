export const registerLanguage = (monaco, language, completionItemProvider) => {
    const { id, loader } = language;
    const languages = monaco.languages.getLanguages();
    if (languages.find((l) => l.id === id)) {
        return;
    }
    monaco.languages.register({ id });
    loader().then((monarch) => {
        monaco.languages.setMonarchTokensProvider(id, monarch.language);
        monaco.languages.setLanguageConfiguration(id, monarch.conf);
        monaco.languages.registerCompletionItemProvider(id, completionItemProvider.getCompletionProvider(monaco, language));
    });
};
//# sourceMappingURL=register.js.map