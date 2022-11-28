import React, { useState } from 'react';

import {
  DataTransformerID,
  FieldNamePickerConfigSettings,
  StandardEditorsRegistryItem,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { Button, InlineField, InlineFieldRow, InlineSwitch, Input, CollapsableSection } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';

import { extractJSONPathTransformer } from './extractJSONPath';
import { ExtractJSONPathOptions, SourceField, JSONPath } from './types';

const fieldNamePickerSettings: StandardEditorsRegistryItem<string, FieldNamePickerConfigSettings> = {
  settings: {
    width: 30,
    placeholderText: 'Select field',
  },
  name: '',
  id: '',
  editor: () => null,
};

export const ExtractJSONPathTransformerEditor: React.FC<TransformerUIProps<ExtractJSONPathOptions>> = ({
  input,
  options,
  onChange,
}) => {
  const [sources, setSources] = useState<SourceField[]>(
    options.sources ?? [{ source: '', paths: [{ path: '', alias: '' }] }]
  );

  const addSourceField = () => {
    sources.push({ source: '', paths: [{ path: '', alias: '' }] });
    setSources([...sources]);
  };

  const removeSourceField = (key: number) => {
    sources.splice(key, 1);
    setSources([...sources]);
  };

  const onPickSourceField = (key: number, source?: string) => {
    sources[key].source = source ?? '';
    setSources([...sources]);
    onJSONPathBlur();
  };

  const addJSONPath = (key: number) => {
    if (sources[key].paths) {
      const paths = sources[key].paths;
      if (paths) {
        paths.push({ path: '' });
        setSources([...sources]);
      }
    }
  };

  const removeJSONPath = (keySource: number, keyPath: number) => {
    if (sources[keySource].paths) {
      const paths = sources[keySource].paths;
      if (paths) {
        paths.splice(keyPath, 1);
        setSources([...sources]);
      }
    }
  };

  const onJSONPathChange = (
    event: React.SyntheticEvent<HTMLInputElement>,
    keySource: number,
    keyPath: number,
    type: 'alias' | 'path'
  ) => {
    if (sources[keySource]) {
      const paths = sources[keySource].paths;
      if (paths) {
        if (type === 'alias') {
          paths[keyPath].alias = event.currentTarget.value ?? '';
        } else {
          paths[keyPath].path = event.currentTarget.value ?? '';
        }
        setSources([...sources]);
      }
    }
  };

  const onJSONPathBlur = () => {
    onChange({
      ...options,
      sources: sources,
    });
  };

  const onToggleReplace = () => {
    onChange({
      ...options,
      replace: !options.replace,
    });
  };

  const onToggleKeepTime = () => {
    onChange({
      ...options,
      keepTime: !options.keepTime,
    });
  };

  const getFieldDoc = () => {
    const mapValidPaths = [
      { path: '*', describtion: '=> extract nothing but applies alias' },
      { path: 'object', describtion: '=> extract fields from object' },
      { path: 'object.value1', describtion: '=> extract value1' },
      { path: 'object.value2', describtion: '=> extract value2' },
      { path: 'object.value2[0]', describtion: '=> extract value2 first element' },
      { path: 'object.value2[1]', describtion: '=> extract value2 second element' },
    ];

    return (
      <p>
        A valid path of an json object.
        <br></br>
        <br></br>
        <b>JSON Value:</b>
        <pre>
          <code>
            {['{', '  "object": {', '    "value1": "hello world"', '    "value2": [1, 2, 3, 4]', '  }', '}'].join('\n')}
          </code>
        </pre>
        <br></br>
        <b>Valid Paths:</b>
        {mapValidPaths.map((value, key) => {
          return (
            <p key={key}>
              <code>{value.path}</code>
              <i>{value.describtion}</i>
            </p>
          );
        })}
      </p>
    );
  };

  return (
    <div>
      {!!sources.length &&
        sources.map((valueSource: SourceField, keySource: number) => (
          <>
            <CollapsableSection
              label={valueSource.source.length > 0 ? valueSource.source : 'NewSource'}
              isOpen={true}
              key={keySource}
            >
              <InlineFieldRow>
                <InlineField label={'Source'} labelWidth={16}>
                  <FieldNamePicker
                    context={{ data: input }}
                    value={valueSource.source ?? ''}
                    onChange={(select?: string) => onPickSourceField(keySource, select)}
                    item={fieldNamePickerSettings}
                  />
                </InlineField>
                {sources.length > 1 && (
                  <InlineField>
                    <Button onClick={() => removeSourceField(keySource)} size="md" variant={'secondary'}>
                      -
                    </Button>
                  </InlineField>
                )}
                {valueSource.source && sources.length - 1 === keySource && (
                  <InlineField>
                    <Button onClick={addSourceField} size="md" variant={'secondary'}>
                      +
                    </Button>
                  </InlineField>
                )}
              </InlineFieldRow>
              {!!valueSource.paths?.length &&
                valueSource.paths.map((valuePath: JSONPath, keyPath: number) => (
                  <InlineFieldRow key={keyPath}>
                    <InlineField label="Field" tooltip={getFieldDoc} grow>
                      <Input
                        onBlur={onJSONPathBlur}
                        onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
                          onJSONPathChange(event, keySource, keyPath, 'path')
                        }
                        value={valuePath.path}
                        placeholder='A valid json path, e.g. "object.value1" or "object.value2[0]"'
                      />
                    </InlineField>
                    <InlineField
                      label="Alias"
                      tooltip="An alias name for the variable in the dashboard. If left blank the given path will be used."
                    >
                      <Input
                        width={12}
                        value={valuePath.alias}
                        onBlur={onJSONPathBlur}
                        onChange={(event: React.SyntheticEvent<HTMLInputElement>) =>
                          onJSONPathChange(event, keySource, keyPath, 'alias')
                        }
                      />
                    </InlineField>
                    {valueSource.paths && valueSource.paths.length > 1 && (
                      <InlineField>
                        <Button onClick={() => removeJSONPath(keySource, keyPath)} size="md" variant={'secondary'}>
                          -
                        </Button>
                      </InlineField>
                    )}
                    {valuePath.path && valueSource.paths && valueSource.paths.length - 1 === keyPath && (
                      <InlineField>
                        <Button onClick={() => addJSONPath(keySource)} size="md" variant={'secondary'}>
                          +
                        </Button>
                      </InlineField>
                    )}
                  </InlineFieldRow>
                ))}
            </CollapsableSection>
            <hr />
          </>
        ))}
      <InlineFieldRow>
        <InlineField label={'Replace all fields'} labelWidth={16}>
          <InlineSwitch value={options.replace ?? false} onChange={onToggleReplace} />
        </InlineField>
      </InlineFieldRow>
      {options.replace && (
        <InlineFieldRow>
          <InlineField label={'Keep Time'} labelWidth={16}>
            <InlineSwitch value={options.keepTime ?? false} onChange={onToggleKeepTime} />
          </InlineField>
        </InlineFieldRow>
      )}
    </div>
  );
};

export const extractJSONPathTransformRegistryItem: TransformerRegistryItem<ExtractJSONPathOptions> = {
  id: DataTransformerID.extractJSONPath,
  editor: ExtractJSONPathTransformerEditor,
  transformation: extractJSONPathTransformer,
  name: 'Extract JSON Paths',
  description: `Parse fields from given JSON Paths`,
};
