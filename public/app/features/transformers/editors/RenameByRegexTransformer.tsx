import { memo, useState, type FocusEvent, type FormEvent } from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  stringToJsRegex,
  TransformerCategory,
} from '@grafana/data';
import { RenameByRegexTransformerOptions } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { InlineField, Input } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/renameByRegex.svg';
import lightImage from '../images/light/renameByRegex.svg';

function isValidRegex(regex: string): boolean {
  try {
    if (regex) {
      stringToJsRegex(regex);
    }
    return true;
  } catch {
    return false;
  }
}

export const RenameByRegexTransformerEditor = memo(function RenameByRegexTransformerEditor(
  props: TransformerUIProps<RenameByRegexTransformerOptions>
) {
  const { options, onChange } = props;
  const [regex, setRegex] = useState(options.regex);
  const [renamePattern, setRenamePattern] = useState(options.renamePattern);
  const [isRegexValid, setIsRegexValid] = useState(true);

  const handleRegexChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setRegex(value);
    setIsRegexValid(isValidRegex(value));
  };

  const handleRenameChange = (e: FormEvent<HTMLInputElement>) => {
    setRenamePattern(e.currentTarget.value);
  };

  const handleRegexBlur = (e: FocusEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    const valid = isValidRegex(value);
    setIsRegexValid(valid);
    if (valid) {
      onChange({ ...options, regex: value });
    }
  };

  const handleRenameBlur = (e: FocusEvent<HTMLInputElement>) => {
    onChange({ ...options, renamePattern: e.currentTarget.value });
  };

  return (
    <>
      <InlineField
        label={t('transformers.rename-by-regex-transformer-editor.label-match', 'Match')}
        labelWidth={16}
        invalid={!isRegexValid}
        error={!isRegexValid ? 'Invalid pattern' : undefined}
      >
        <Input
          placeholder={t(
            'transformers.rename-by-regex-transformer-editor.placeholder-regular-expression-pattern',
            'Regular expression pattern'
          )}
          value={regex || ''}
          onChange={handleRegexChange}
          onBlur={handleRegexBlur}
          width={25}
        />
      </InlineField>
      <InlineField
        label={t('transformers.rename-by-regex-transformer-editor.label-replace', 'Replace')}
        labelWidth={16}
      >
        <Input
          placeholder={t(
            'transformers.rename-by-regex-transformer-editor.placeholder-replacement-pattern',
            'Replacement pattern'
          )}
          value={renamePattern || ''}
          onChange={handleRenameChange}
          onBlur={handleRenameBlur}
          width={25}
        />
      </InlineField>
    </>
  );
});

export const getRenameByRegexTransformRegistryItem: () => TransformerRegistryItem<RenameByRegexTransformerOptions> =
  () => ({
    id: DataTransformerID.renameByRegex,
    editor: RenameByRegexTransformerEditor,
    transformation: standardTransformers.renameByRegexTransformer,
    name: t('transformers.rename-by-regex-transformer.name.rename-fields-by-regex', 'Rename fields by regex'),
    description: t(
      'transformers.rename-by-regex-transformer.description.rename-parts-using-regex',
      'Rename parts of the query results using a regular expression and replacement pattern.'
    ),
    categories: new Set([TransformerCategory.ReorderAndRename]),
    help: getTransformationContent(DataTransformerID.renameByRegex).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  });
