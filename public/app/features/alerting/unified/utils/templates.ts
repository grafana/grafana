export function ensureDefine(templateName: string, templateContent: string): string {
  // notification template content must be wrapped in {{ define "name" }} tag,
  // but this is not obvious because user also has to provide name separately in the form.
  // so if user does not manually add {{ define }} tag, we do it automatically
  let content = templateContent.trim();
  if (!content.match(/\{\{\s*define/)) {
    const indentedContent = content
      .split('\n')
      .map((line) => '  ' + line)
      .join('\n');
    content = `{{ define "${templateName}" }}\n${indentedContent}\n{{ end }}`;
  }
  return content;
}
export function updateAndSanitizeDefine(newDefine: string, templateContent: string): string {
  return templateContent.replace(
    /\{\{\s*define\s*\"\w*/,
    `{{ define "${newDefine.replace(/\(/g, '').replace(/\)/g, '').replace(/\s/g, '.')}`
  );
}
