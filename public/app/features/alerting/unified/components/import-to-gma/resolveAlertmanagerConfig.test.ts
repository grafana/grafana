import {
  mergeTemplateFiles,
  parseAlertmanagerYaml,
  readTemplateFiles,
  resolveAlertmanagerConfig,
} from './resolveAlertmanagerConfig';

function templateFile(name: string, content: string) {
  return new File([content], name, { type: 'text/plain' });
}

const SAMPLE_YAML = ['route:', '  receiver: default', 'receivers:', '  - name: default', ''].join('\n');
// Genuinely invalid per js-yaml: bad indentation of a mapping entry.
const INVALID_YAML = ['route:', '  receiver: default', 'foo: bar: baz', ''].join('\n');

describe('parseAlertmanagerYaml', () => {
  it('separates template_files from the rest of the config', () => {
    const yaml = ['route:', '  receiver: default', 'template_files:', '  email.tmpl: "body"', ''].join('\n');
    const result = parseAlertmanagerYaml(yaml);

    expect(result.templateFiles).toEqual({ 'email.tmpl': 'body' });
    expect(JSON.parse(result.alertmanagerConfig)).toEqual({ route: { receiver: 'default' } });
  });

  it('returns an empty template map when there is no template_files key', () => {
    const result = parseAlertmanagerYaml(SAMPLE_YAML);
    expect(result.templateFiles).toEqual({});
  });

  // Regression: this used to swallow the error and ship the raw YAML anyway.
  it('throws a friendly local message for invalid YAML instead of swallowing the error', () => {
    expect(() => parseAlertmanagerYaml(INVALID_YAML)).toThrow(/syntax error/i);
  });
});

describe('readTemplateFiles', () => {
  it('returns an empty map when there are no files', async () => {
    expect(await readTemplateFiles()).toEqual({});
    expect(await readTemplateFiles([])).toEqual({});
  });

  it('keys each file by its name with the file content as the value', async () => {
    const result = await readTemplateFiles([
      templateFile('email.tmpl', 'email body'),
      templateFile('slack.tmpl', 'slack body'),
    ]);

    expect(result).toEqual({ 'email.tmpl': 'email body', 'slack.tmpl': 'slack body' });
  });

  it('rejects when two files share the same name', async () => {
    await expect(
      readTemplateFiles([templateFile('dupe.tmpl', 'one'), templateFile('dupe.tmpl', 'two')])
    ).rejects.toThrow('dupe.tmpl');
  });
});

describe('mergeTemplateFiles', () => {
  it('layers uploaded templates on top of the embedded ones', () => {
    expect(mergeTemplateFiles({ 'embedded.tmpl': 'a' }, { 'uploaded.tmpl': 'b' })).toEqual({
      'embedded.tmpl': 'a',
      'uploaded.tmpl': 'b',
    });
  });

  it('returns a copy of the embedded map when there are no uploaded templates', () => {
    const embedded = { 'embedded.tmpl': 'a' };
    const merged = mergeTemplateFiles(embedded, {});

    expect(merged).toEqual(embedded);
    expect(merged).not.toBe(embedded);
  });

  it('throws when an uploaded name collides with an embedded template', () => {
    expect(() => mergeTemplateFiles({ 'shared.tmpl': 'embedded' }, { 'shared.tmpl': 'uploaded' })).toThrow(
      'shared.tmpl'
    );
  });
});

describe('resolveAlertmanagerConfig', () => {
  it('rejects a YAML file with invalid syntax without needing a network call', async () => {
    await expect(
      resolveAlertmanagerConfig({
        source: 'yaml',
        yamlFile: new File([INVALID_YAML], 'broken.yaml', { type: 'application/yaml' }),
        configIdentifier: 'prod',
      })
    ).rejects.toThrow(/syntax error/i);
  });

  it('merges separately-uploaded template files into the resolved config', async () => {
    const result = await resolveAlertmanagerConfig({
      source: 'yaml',
      yamlFile: new File([SAMPLE_YAML], 'am.yaml', { type: 'application/yaml' }),
      templateFiles: [templateFile('email.tmpl', 'email body')],
      configIdentifier: 'prod',
    });

    expect(result.templateFiles).toEqual({ 'email.tmpl': 'email body' });
  });
});
