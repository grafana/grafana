/**
 * This function parses the template content and returns an array of Template objects.
 * Each Template object represents a single template definition found in the content.
 *
 * There are several rules for parsing the template content:
 * - The template content may use the "-" symbol for whitespace trimming. If a template's left delimiter ("{{")
 *   is immediately followed by a "-" and whitespace, all trailing whitespace is removed from the preceding text.
 * - Similarly, if the right delimiter ("}}") is immediately preceded by whitespace and a "-", all leading whitespace
 *  is removed from the following text. In these cases, the whitespace must be present for the trimming to occur.
 * - The template content may contain nested templates. The nested templates are appended to the main template content,
 *  and the nested templates are removed from the list of templates.
 * - We don't return templates with names starting with "__" as they are considered internal templates.
 *
 * @param templatesString is a string containing the template content. Each template is defined within
 * "{{ define "templateName" }}" and "{{ end }}" delimiters.But it may also contain nested templates.
 */

import { Template } from './TemplateSelector';

export function parseTemplates(templatesString: string): Template[] {
  const templates: Record<string, Template> = {};
  const stack: Array<{ type: string; startIndex: number; name?: string }> = [];
  const regex = /{{-?\s*(define|end|if|range|else|with|template|block)\b(.*?)-?}}/gs;

  let match;
  let currentIndex = 0;

  while ((match = regex.exec(templatesString)) !== null) {
    const [, keyword, middleContent] = match;
    currentIndex = match.index;

    if (keyword === 'define') {
      const nameMatch = middleContent?.match(/"([^"]+)"/);
      if (nameMatch) {
        stack.push({ type: 'define', startIndex: currentIndex, name: nameMatch[1] });
      }
    } else if (keyword === 'end') {
      let top = stack.pop();
      while (
        top &&
        top.type !== 'define' &&
        top.type !== 'if' &&
        top.type !== 'range' &&
        top.type !== 'with' &&
        top.type !== 'block'
      ) {
        top = stack.pop();
      }
      if (top) {
        const endIndex = regex.lastIndex;
        if (top.type === 'define' && !top.name?.startsWith('__')) {
          templates[top.name!] = {
            name: top.name!,
            content: templatesString.slice(top.startIndex, endIndex),
          };
        }
      }
    } else if (
      keyword === 'if' ||
      keyword === 'range' ||
      keyword === 'else' ||
      keyword === 'with' ||
      keyword === 'block'
    ) {
      stack.push({ type: keyword, startIndex: currentIndex });
    }
  }
  // Append sub-template content to the end of the main template and remove sub-templates from the list
  for (const template of Object.values(templates)) {
    const regex = /{{ template "([^"]+)" }}/g;
    let match;
    while ((match = regex.exec(template.content)) !== null) {
      const name = match[1];
      if (templates[name]?.content) {
        template.content += '\n' + templates[name]?.content;
        delete templates[name]; // Remove the sub-template from the list
      }
    }
  }

  return Object.values(templates);
}

export function getUseTemplateText(templateName: string) {
  return `{{ template "${templateName}" . }}`;
}

export function getTemplateName(useTemplateText: string) {
  const match = useTemplateText.match(/\{\{\s*template\s*"(.*)"\s*\.\s*\}\}/);
  return match ? match[1] : '';
}

/* This function checks if the a field value contains only one template usage
    for example:
    "{{ template "templateName" . }}"" returns true
    but "{{ template "templateName" . }} some text {{ template "templateName" . }}"" returns false
    and "{{ template "templateName" . }} some text" some text returns false
**/

export function matchesOnlyOneTemplate(fieldValue: string) {
  const pattern = /\{\{\s*template\s*".*?"\s*\.\s*\}\}/g;
  const matches = fieldValue.match(pattern);

  if (matches?.length !== 1) {
    return false;
  }

  // Split the content by the template pattern
  const parts = fieldValue.split(pattern);

  // Check if there is any non-whitespace text outside the template pattern
  for (const part of parts) {
    if (part.trim() !== '') {
      return false;
    }
  }

  return true;
}
