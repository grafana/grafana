// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  Switch,
  PanelOptionsGrid,
  PanelOptionsGroup,
  FormLabel,
  Select,
  DataLinksEditor,
  VariableOrigin,
  VariableSuggestion,
} from '@grafana/ui';

// Types
import { Options } from './types';
import { SortOrder } from 'app/core/utils/explore';
import { DataLink, SelectableValue } from '@grafana/data';

const sortOrderOptions = [
  { value: SortOrder.Descending, label: 'Descending' },
  { value: SortOrder.Ascending, label: 'Ascending' },
];

type Props = PanelEditorProps<Options>;
type State = {
  suggestions: VariableSuggestion[];
};
export class LogsPanelEditor extends PureComponent<Props, State> {
  state = {
    suggestions: [] as VariableSuggestion[],
  };

  async componentDidMount() {
    const suggestions = await this.getSuggestions();
    this.setState({ suggestions });
  }

  async componentDidUpdate(prevProps: Props) {
    if (this.props.datasource !== prevProps.datasource) {
      const suggestions = await this.getSuggestions();
      this.setState({ suggestions });
    }
  }

  onToggleTime = () => {
    const { options, onOptionsChange } = this.props;
    const { showTime } = options;

    onOptionsChange({ ...options, showTime: !showTime });
  };

  onShowValuesChange = (item: SelectableValue<SortOrder>) => {
    const { options, onOptionsChange } = this.props;
    onOptionsChange({ ...options, sortOrder: item.value });
  };

  onDataLinksChange = (dataLinks: DataLink[]) => {
    const { options, onOptionsChange } = this.props;
    onOptionsChange({ ...options, dataLinks });
  };

  getSuggestions = async (): Promise<VariableSuggestion[]> => {
    const { datasource } = this.props;
    const fields = await datasource.getDerivedFields({});
    const suggestions: VariableSuggestion[] = [];
    for (const key of Object.keys(fields)) {
      const prefix = key;
      for (const key2 of Object.keys(fields[key].value)) {
        suggestions.push({
          value: `${prefix}.${key2}`,
          label: key2,
          origin: VariableOrigin.Field,
        });
      }
    }
    return suggestions;
  };

  render() {
    const { showTime, sortOrder, dataLinks } = this.props.options;
    const value = sortOrderOptions.filter(option => option.value === sortOrder)[0];

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Columns">
            <Switch label="Time" labelClass="width-10" checked={showTime} onChange={this.onToggleTime} />
            <div className="gf-form">
              <FormLabel>Order</FormLabel>
              <Select options={sortOrderOptions} value={value} onChange={this.onShowValuesChange} />
            </div>
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Data links">
            <DataLinksEditor
              value={dataLinks}
              onChange={this.onDataLinksChange}
              suggestions={this.state.suggestions}
              maxLinks={10}
            />
          </PanelOptionsGroup>
        </PanelOptionsGrid>
      </>
    );
  }
}
