import { css } from '@emotion/css';
import React from 'react';

import {
  DataTransformerID,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
  stringToJsRegex,
  TransformerCategory,
} from '@grafana/data';
import { RenameByRegexTransformerOptions } from '@grafana/data/src/transformations/transformers/renameByRegex';
import { Field, Input } from '@grafana/ui';

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
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Match</div>
            <Field
              invalid={!isRegexValid}
              error={!isRegexValid ? 'Invalid pattern' : undefined}
              className={css`
                margin-bottom: 0;
              `}
            >
              <Input
                placeholder="Regular expression pattern"
                value={regex || ''}
                onChange={this.handleRegexChange}
                onBlur={this.handleRegexBlur}
                width={25}
              />
            </Field>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Replace</div>
            <Field
              className={css`
                margin-bottom: 0;
              `}
            >
              <Input
                placeholder="Replacement pattern"
                value={renamePattern || ''}
                onChange={this.handleRenameChange}
                onBlur={this.handleRenameBlur}
                width={25}
              />
            </Field>
          </div>
        </div>
      </>
    );
  }
}

export const renameByRegexTransformRegistryItem: TransformerRegistryItem<RenameByRegexTransformerOptions> = {
  id: DataTransformerID.renameByRegex,
  editor: RenameByRegexTransformerEditor,
  transformation: standardTransformers.renameByRegexTransformer,
  name: 'Rename by regex',
  description: 'Renames part of the query result by using regular expression with placeholders.',
  categories: new Set([TransformerCategory.ReorderAndRename]),
};
