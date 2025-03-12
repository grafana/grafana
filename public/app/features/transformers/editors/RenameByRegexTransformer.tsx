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
import { InlineField, Input } from '@grafana/ui';

import { getTransformationContent } from '../docs/getTransformationContent';

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
          label="Match"
          labelWidth={16}
          invalid={!isRegexValid}
          error={!isRegexValid ? 'Invalid pattern' : undefined}
        >
          <Input
            placeholder="Regular expression pattern"
            value={regex || ''}
            onChange={this.handleRegexChange}
            onBlur={this.handleRegexBlur}
            width={25}
          />
        </InlineField>
        <InlineField label="Replace" labelWidth={16}>
          <Input
            placeholder="Replacement pattern"
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

export const renameByRegexTransformRegistryItem: TransformerRegistryItem<RenameByRegexTransformerOptions> = {
  id: DataTransformerID.renameByRegex,
  editor: RenameByRegexTransformerEditor,
  transformation: standardTransformers.renameByRegexTransformer,
  name: standardTransformers.renameByRegexTransformer.name,
  description: 'Renames part of the query result by using regular expression with placeholders.',
  categories: new Set([TransformerCategory.ReorderAndRename]),
  help: getTransformationContent(DataTransformerID.renameByRegex).helperDocs,
};
