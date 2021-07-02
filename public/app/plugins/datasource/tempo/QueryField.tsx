import { css } from '@emotion/css';
import { ExploreQueryFieldProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  BracesPlugin,
  InlineField,
  InlineFieldRow,
  LegacyForms,
  QueryField,
  RadioButtonGroup,
  SlatePrism,
  TypeaheadInput,
  TypeaheadOutput,
} from '@grafana/ui';
import Prism from 'prismjs';
import React from 'react';
import { Node } from 'slate';
import { AdvancedOptions } from './AdvancedOptions';
import { TempoDatasource, TempoQuery, TempoQueryType } from './datasource';
import { tokenizer } from './syntax';

type Props = ExploreQueryFieldProps<TempoDatasource, TempoQuery>;
const DEFAULT_QUERY_TYPE: TempoQueryType = 'traceId';
interface State {
  syntaxLoaded: boolean;
}

const PRISM_LANGUAGE = 'tempo';
const plugins = [
  BracesPlugin(),
  SlatePrism({
    onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
    getSyntax: () => PRISM_LANGUAGE,
  }),
];
export class TempoQueryField extends React.PureComponent<Props, State> {
  state = {
    syntaxLoaded: false,
  };

  constructor(props: Props) {
    super(props);
  }

  async componentDidMount() {
    Prism.languages[PRISM_LANGUAGE] = tokenizer;

    await this.props.datasource.languageProvider.start();

    this.setState({ syntaxLoaded: true });
  }

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource } = this.props;

    const languageProvider = datasource.languageProvider;

    return await languageProvider.provideCompletionItems(typeahead);
  };

  // get the last text after a space delimiter
  cleanText = (text: string) => {
    const splittedText = text.split(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g);
    if (splittedText.length > 1) {
      return splittedText[splittedText.length - 1];
    }
    return text;
  };

  render() {
    const { query, onChange } = this.props;

    return (
      <>
        <InlineFieldRow>
          <InlineField label="Query type">
            <RadioButtonGroup<TempoQueryType>
              options={[
                { value: 'search', label: 'Search' },
                { value: 'traceId', label: 'TraceID' },
              ]}
              value={query.queryType || DEFAULT_QUERY_TYPE}
              onChange={(v) =>
                onChange({
                  ...query,
                  queryType: v,
                })
              }
              size="md"
            />
          </InlineField>
        </InlineFieldRow>
        {query.queryType === 'search' && (
          <>
            <InlineFieldRow>
              <InlineField label="Query" labelWidth={21} grow>
                <QueryField
                  additionalPlugins={plugins}
                  query={query.search}
                  onTypeahead={this.onTypeahead}
                  onBlur={this.props.onBlur}
                  onChange={(value) => {
                    onChange({
                      ...query,
                      search: value,
                    });
                  }}
                  cleanText={this.cleanText}
                  onRunQuery={this.props.onRunQuery}
                  syntaxLoaded={this.state.syntaxLoaded}
                  portalOrigin="tempo"
                />
              </InlineField>
            </InlineFieldRow>
            <div className={css({ width: '50%' })}>
              <AdvancedOptions query={query} onChange={onChange} />
            </div>
          </>
        )}
        {query.queryType !== 'search' && (
          <LegacyForms.FormField
            label="Trace ID"
            labelWidth={4}
            inputEl={
              <div className="slate-query-field__wrapper">
                <div className="slate-query-field" aria-label={selectors.components.QueryField.container}>
                  <input
                    style={{ width: '100%' }}
                    value={query.query || ''}
                    onChange={(e) =>
                      onChange({
                        ...query,
                        query: e.currentTarget.value,
                        queryType: 'traceId',
                      })
                    }
                  />
                </div>
              </div>
            }
          />
        )}
      </>
    );
  }
}
