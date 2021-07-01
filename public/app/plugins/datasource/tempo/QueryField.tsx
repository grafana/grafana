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

  // onChangeLinkedQuery = (value: DataQuery) => {
  //   const { query, onChange } = this.props;
  //   onChange({
  //     ...query,
  //     linkedQuery: { ...value, refId: 'linked' },
  //   });
  // };

  // onRunLinkedQuery = () => {
  //   this.props.onRunQuery();
  // };

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource } = this.props;

    const languageProvider = datasource.languageProvider;

    return await languageProvider.provideCompletionItems(typeahead);
  };

  render() {
    const { query, onChange } = this.props;
    // const { linkedDatasource } = this.state;

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
        {/* {query.queryType === 'search' && linkedDatasource && (
          <>
            <InlineLabel>
              Tempo uses {((linkedDatasource as unknown) as DataSourceApi).name} to find traces.
            </InlineLabel>

            <LokiQueryField
              datasource={linkedDatasource!}
              onChange={this.onChangeLinkedQuery}
              onRunQuery={this.onRunLinkedQuery}
              query={this.props.query.linkedQuery ?? ({ refId: 'linked' } as any)}
              history={[]}
            />
          </>
        )}
        {query.queryType === 'search' && !linkedDatasource && (
          <div className="text-warning">Please set up a Traces-to-logs datasource in the datasource settings.</div>
        )} */}
        {query.queryType === 'search' && (
          <div className={css({ width: '50%' })}>
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
                  onRunQuery={this.props.onRunQuery}
                  syntaxLoaded={this.state.syntaxLoaded}
                  portalOrigin="tempo"
                />
              </InlineField>
            </InlineFieldRow>
            <AdvancedOptions query={query} onChange={onChange} />
          </div>
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
