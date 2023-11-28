export const GO_TEMPLATE_LANGUAGE_ID = 'go-template';
const goTemplateLanguageDefinition = {
    id: GO_TEMPLATE_LANGUAGE_ID,
    extensions: [],
    aliases: [],
    mimetypes: [],
    loader: () => import('./language'),
};
export default goTemplateLanguageDefinition;
//# sourceMappingURL=definition.js.map