import { getTemplateOptions } from './TemplateSelector';

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
    };

    const result = getTemplateOptions(templateFiles);

    expect(result).toEqual([
      {
        label: 'template1',
        value: {
          name: 'template1',
          content:
            '{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s) this is the last one',
        },
      },
      {
        label: 'email.subject',
        value: {
          name: 'email.subject',
          content: '{{ len .Alerts.Firing }} firing alert(s), {{ len .Alerts.Resolved }} resolved alert(s)',
        },
      },
      {
        label: 'template_with_minus',
        value: {
          name: 'template_with_minus',
          content: '{{ .Annotations.summary }}',
        },
      },
    ]);
  });
});
