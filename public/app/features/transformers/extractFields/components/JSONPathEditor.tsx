import { css, cx } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { Button, InlineField, InlineFieldRow, IconButton, Input } from '@grafana/ui';

import { JSONPath } from '../types';

interface Props {
  options: JSONPath[];
  onChange: (options: JSONPath[]) => void;
}

export function JSONPathEditor({ options, onChange }: Props) {
  const [paths, setPaths] = useState<JSONPath[]>(options);
  const tooltips = getTooltips();
  const style = getStyle();

  const addJSONPath = () => {
    paths.push({ path: '' });
    setPaths([...paths]);
    onBlur();
  };

  const removeJSONPath = (keyPath: number) => {
    if (paths) {
      paths.splice(keyPath, 1);
      setPaths([...paths]);
      onBlur();
    }
  };

  const onJSONPathChange = (event: React.SyntheticEvent<HTMLInputElement>, keyPath: number, type: 'alias' | 'path') => {
    if (paths) {
      if (type === 'alias') {
        paths[keyPath].alias = event.currentTarget.value ?? '';
      } else {
        paths[keyPath].path = event.currentTarget.value ?? '';
      }
      setPaths([...paths]);
    }
  };

  const onBlur = () => {
    onChange(paths);
  };

  return (
    <ol className={cx(style.list)}>
      {paths &&
        paths.map((path: JSONPath, key: number) => (
          <li key={key}>
            <InlineFieldRow>
              <InlineField label="Field" tooltip={tooltips.field} grow>
                <Input
                  onBlur={onBlur}
                  onChange={(event: React.SyntheticEvent<HTMLInputElement>) => onJSONPathChange(event, key, 'path')}
                  value={path.path}
                  placeholder='A valid json path, e.g. "object.value1" or "object.value2[0]"'
                />
              </InlineField>
              <InlineField label="Alias" tooltip={tooltips.alias}>
                <Input
                  width={12}
                  value={path.alias}
                  onBlur={onBlur}
                  onChange={(event: React.SyntheticEvent<HTMLInputElement>) => onJSONPathChange(event, key, 'alias')}
                />
              </InlineField>
              <InlineField className={cx(style.removeIcon)}>
                <IconButton onClick={() => removeJSONPath(key)} name={'trash-alt'} tooltip="Remove path" />
              </InlineField>
            </InlineFieldRow>
          </li>
        ))}
      <InlineField>
        <Button icon={'plus'} onClick={() => addJSONPath()} variant={'secondary'}>
          Add path
        </Button>
      </InlineField>
    </ol>
  );
}

const getTooltips = () => {
  const mapValidPaths = [
    { path: 'object', description: '=> extract fields from object' },
    { path: 'object.value1', description: '=> extract value1' },
    { path: 'object.value2', description: '=> extract value2' },
    { path: 'object.value2[0]', description: '=> extract value2 first element' },
    { path: 'object.value2[1]', description: '=> extract value2 second element' },
  ];

  return {
    field: (
      <div>
        A valid path of an json object.
        <div>
          <strong>JSON Value:</strong>
        </div>
        <pre>
          <code>
            {['{', '  "object": {', '    "value1": "hello world"', '    "value2": [1, 2, 3, 4]', '  }', '}'].join('\n')}
          </code>
        </pre>
        <strong>Valid Paths:</strong>
        {mapValidPaths.map((value, key) => {
          return (
            <p key={key}>
              <code>{value.path}</code>
              <i>{value.description}</i>
            </p>
          );
        })}
      </div>
    ),
    alias: 'An alias name for the variable in the dashboard. If left blank the given path will be used.',
  };
};

function getStyle() {
  return {
    list: css({
      marginLeft: '20px',
    }),
    removeIcon: css({
      margin: '0 0 0 4px',
      alignItems: 'center',
    }),
  };
}
