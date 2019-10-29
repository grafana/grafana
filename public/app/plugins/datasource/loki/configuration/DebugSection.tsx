import React, { useState } from 'react';
import { css } from 'emotion';
import cx from 'classnames';
import { FormField } from '@grafana/ui';
import { DerivedFieldConfig } from '../types';

type Props = {
  derivedFields: DerivedFieldConfig[];
  className?: string;
};
export const DebugSection = (props: Props) => {
  const { derivedFields, className } = props;
  const [debugText, setDebugText] = useState('');

  let results: any[] = [];
  if (debugText && derivedFields) {
    results = makeDebugFields(derivedFields, debugText);
  }

  return (
    <div className={className}>
      <FormField
        labelWidth={12}
        label={'Debug input'}
        inputEl={
          <textarea
            className={cx(
              'gf-form-input gf-form-textarea',
              css`
                width: 100%;
              `
            )}
            value={debugText}
            onChange={event => setDebugText(event.currentTarget.value)}
          />
        }
      />
      {!!results.length &&
        results.map(result => {
          return (
            <div key={result.name}>
              {result.name} = {result.result || '<no match>'}
            </div>
          );
        })}
    </div>
  );
};

// TODO: this should also interpolate url but for that we need the link service here somehow
function makeDebugFields(derivedFields: DerivedFieldConfig[], debugText: string) {
  return derivedFields.reduce((acc, field) => {
    if (field.name && field.matcherRegex) {
      try {
        const testMatch = debugText.match(field.matcherRegex);

        acc.push({
          name: field.name,
          result: (testMatch && testMatch[1]) || '<no match>',
        });
        return acc;
      } catch (error) {
        acc.push({
          label: field.name,
          error,
        });
        return acc;
      }
    }
    return acc;
  }, []);
}
