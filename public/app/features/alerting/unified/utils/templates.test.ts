import { updateAndSanitizeDefine } from './templates';

describe('updateAndSanitizeDefine method', () => {
  it('Should update the define value with the new one, and remove ( and ), and replace white spaces with a dot', () => {
    expect(updateAndSanitizeDefine('new value', 'dkjghskdjhgsdf')).toBe('dkjghskdjhgsdf');
    expect(
      updateAndSanitizeDefine(
        'new value',
        `{{ define "t" }}
      {{.Alerts.Firing}}
    {{ end }}`
      )
    ).toBe(`{{ define "new.value" }}
      {{.Alerts.Firing}}
    {{ end }}`);
    expect(
      updateAndSanitizeDefine(
        '(new) ()value',
        `{{ define "t" }}
    {{.Alerts.Firing}}
  {{ end }}`
      )
    ).toBe(`{{ define "new.value" }}
    {{.Alerts.Firing}}
  {{ end }}`);
  });
});
