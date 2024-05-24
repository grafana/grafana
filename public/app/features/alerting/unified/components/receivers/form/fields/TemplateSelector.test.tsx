import { DEFAULT_TEMPLATES } from 'app/features/alerting/unified/utils/template-constants';

import { getTemplateOptions } from './TemplateSelector';
import { parseTemplates } from './utils';

describe('getTemplateOptions function', () => {
  it('should return the last template when there are duplicates', () => {
    const templateFiles = {
      file1:
        '{{ define "template1" }}{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s){{ end }}',
      // duplicated define, the last one should be returned
      file2:
        '{{ define "template1" }}{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s) this is the last one{{ end }}',
      file3:
        '{{ define "email.subject" }}{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s){{ end }}',
      // define with a minus sign
      file4: '{{ define "template_with_minus" -}}{{ .Annotations.summary }}{{- end }}',
      file5: '',
      //nested templates
      file6: `{{ define "nested" }}
      Main Template Content
      {{ template "sub1" }}
      {{ template "sub2" }}
      {{ end }}
      
      {{ define "sub1" }}
      Sub Template 1 Content
      {{ end }}
      
      {{ define "sub2" }}
      Sub Template 2 Content
      {{ end }}`,
    };
    const defaultTemplates = parseTemplates(DEFAULT_TEMPLATES);
    const result = getTemplateOptions(templateFiles, defaultTemplates);

    const template1Matches = result.filter((option) => option.label === 'template1');
    expect(template1Matches).toHaveLength(1);
    expect(template1Matches[0].value?.content).toMatch(/this is the last one/i);

    const file5Matches = result.filter((option) => option.label === 'file5');
    expect(file5Matches).toHaveLength(0);

    expect(result).toMatchSnapshot();
  });
});
