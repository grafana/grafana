import { css, cx } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { Trans, t } from '@grafana/i18n';
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
              <InlineField label={t('transformers.jsonpath-editor.label-field', 'Field')} tooltip={tooltips.field} grow>
                <Input
                  onBlur={onBlur}
                  onChange={(event: React.SyntheticEvent<HTMLInputElement>) => onJSONPathChange(event, key, 'path')}
                  value={path.path}
                  placeholder={t(
                    'transformers.jsonpath-editor.placeholder-valid-objectvalue',
                    'A valid json path, e.g. "object.value1" or "object.value2[0]"'
                  )}
                />
              </InlineField>
              <InlineField label={t('transformers.jsonpath-editor.label-alias', 'Alias')} tooltip={tooltips.alias}>
                <Input
                  width={12}
                  value={path.alias}
                  onBlur={onBlur}
                  onChange={(event: React.SyntheticEvent<HTMLInputElement>) => onJSONPathChange(event, key, 'alias')}
                />
              </InlineField>
              <InlineField className={cx(style.removeIcon)}>
                <IconButton
                  onClick={() => removeJSONPath(key)}
                  name={'trash-alt'}
                  tooltip={t('transformers.jsonpath-editor.tooltip-remove-path', 'Remove path')}
                />
              </InlineField>
            </InlineFieldRow>
          </li>
        ))}
      <InlineField>
        <Button icon={'plus'} onClick={() => addJSONPath()} variant={'secondary'}>
          <Trans i18nKey="transformers.jsonpath-editor.add-path">Add path</Trans>
        </Button>
      </InlineField>
    </ol>
  );
}

const getTooltips = () => {
  const mapValidPaths = [
    {
      path: 'object',
      description: t(
        'transformers.get-tooltips.map-valid-paths.description.extract-fields-from-object',
        '=> extract fields from object'
      ),
    },
    {
      path: 'object.value1',
      description: (
        <Trans
          i18nKey="transformers.get-tooltips.map-valid-paths.description.extract-value"
          values={{ value: 'value1' }}
        >
          =&gt; extract <code>{'{{ value }}'}</code>
        </Trans>
      ),
    },
    {
      path: 'object.value2',
      description: (
        <Trans
          i18nKey="transformers.get-tooltips.map-valid-paths.description.extract-value"
          values={{ value: 'value2' }}
        >
          =&gt; extract <code>{'{{ value }}'}</code>
        </Trans>
      ),
    },
    {
      path: 'object.value2[0]',
      description: (
        <Trans
          i18nKey="transformers.get-tooltips.map-valid-paths.description.extract-value-first-element"
          values={{ value: 'value2' }}
        >
          =&gt; extract <code>{'{{ value }}'}</code> first element
        </Trans>
      ),
    },
    {
      path: 'object.value2[1]',
      description: (
        <Trans
          i18nKey="transformers.get-tooltips.map-valid-paths.description.extract-value-second-element"
          values={{ value: 'value2' }}
        >
          =&gt; extract <code>{'{{ value }}'}</code> second element
        </Trans>
      ),
    },
  ];

  return {
    field: (
      <div>
        <Trans i18nKey="transformers.get-tooltips.description">A valid path of an json object.</Trans>
        <div>
          <strong>
            <Trans i18nKey="transformers.get-tooltips.json-value">JSON Value:</Trans>
          </strong>
        </div>
        <pre>
          <code>
            {['{', '  "object": {', '    "value1": "hello world"', '    "value2": [1, 2, 3, 4]', '  }', '}'].join('\n')}
          </code>
        </pre>
        <strong>
          <Trans i18nKey="transformers.get-tooltips.valid-paths">Valid Paths:</Trans>
        </strong>
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
