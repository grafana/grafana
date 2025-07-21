import * as React from 'react';

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

interface RenameByRegexTransformerEditorProps extends TransformerUIProps<RenameByRegexTransformerOptions> {}

interface RenameByRegexTransformerEditorState {
  regex?: string;
  renamePattern?: string;
  isRegexValid?: boolean;
}

export class RenameByRegexTransformerEditor extends React.PureComponent<
  RenameByRegexTransformerEditorProps,
  RenameByRegexTransformerEditorState
> {
  constructor(props: RenameByRegexTransformerEditorProps) {
    super(props);
    this.state = {
      regex: props.options.regex,
      renamePattern: props.options.renamePattern,
      isRegexValid: true,
    };
  }

  handleRegexChange = (e: React.FormEvent<HTMLInputElement>) => {
    const regex = e.currentTarget.value;
    let isRegexValid = true;
    if (regex) {
      try {
        if (regex) {
          stringToJsRegex(regex);
        }
      } catch (e) {
        isRegexValid = false;
      }
    }
    this.setState((previous) => ({ ...previous, regex, isRegexValid }));
  };

  handleRenameChange = (e: React.FormEvent<HTMLInputElement>) => {
    const renamePattern = e.currentTarget.value;
    this.setState((previous) => ({ ...previous, renamePattern }));
  };

  handleRegexBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const regex = e.currentTarget.value;
    let isRegexValid = true;

    try {
      if (regex) {
        stringToJsRegex(regex);
      }
    } catch (e) {
      isRegexValid = false;
    }

    this.setState({ isRegexValid }, () => {
      if (isRegexValid) {
        this.props.onChange({ ...this.props.options, regex });
      }
    });
  };

  handleRenameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const renamePattern = e.currentTarget.value;
    this.setState({ renamePattern }, () => this.props.onChange({ ...this.props.options, renamePattern }));
  };

  render() {
    const { regex, renamePattern, isRegexValid } = this.state;
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
            onChange={this.handleRegexChange}
            onBlur={this.handleRegexBlur}
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
            onChange={this.handleRenameChange}
            onBlur={this.handleRenameBlur}
            width={25}
          />
        </InlineField>
      </>
    );
  }
}

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
