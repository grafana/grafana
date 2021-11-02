export function ensureDefine(templateName, templateContent) {
    // notification template content must be wrapped in {{ define "name" }} tag,
    // but this is not obvious because user also has to provide name separately in the form.
    // so if user does not manually add {{ define }} tag, we do it automatically
    var content = templateContent.trim();
    if (!content.match(/\{\{\s*define/)) {
        var indentedContent = content
            .split('\n')
            .map(function (line) { return '  ' + line; })
            .join('\n');
        content = "{{ define \"" + templateName + "\" }}\n" + indentedContent + "\n{{ end }}";
    }
    return content;
}
//# sourceMappingURL=templates.js.map