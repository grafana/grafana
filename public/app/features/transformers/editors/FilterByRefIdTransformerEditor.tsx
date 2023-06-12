import React from 'react';

import {
  DataTransformerID,
  KeyValue,
  standardTransformers,
  TransformerRegistryItem,
  TransformerUIProps,
} from '@grafana/data';
import { FilterFramesByRefIdTransformerOptions } from '@grafana/data/src/transformations/transformers/filterByRefId';
import { HorizontalGroup, FilterPill, FieldValidationMessage } from '@grafana/ui';

interface FilterByRefIdTransformerEditorProps extends TransformerUIProps<FilterFramesByRefIdTransformerOptions> {}

interface FilterByRefIdTransformerEditorState {
  include: string;
  options: RefIdInfo[];
  selected: string[];
}

interface RefIdInfo {
  refId: string;
  count: number;
}
export class FilterByRefIdTransformerEditor extends React.PureComponent<
  FilterByRefIdTransformerEditorProps,
  FilterByRefIdTransformerEditorState
> {
  constructor(props: FilterByRefIdTransformerEditorProps) {
    super(props);
    this.state = {
      include: props.options.include || '',
      options: [],
      selected: [],
    };
  }

  componentDidMount() {
    this.initOptions();
  }

  componentDidUpdate(oldProps: FilterByRefIdTransformerEditorProps) {
    if (this.props.input !== oldProps.input) {
      this.initOptions();
    }
  }

  private initOptions() {
    const { input, options } = this.props;
    const configuredOptions = options.include ? options.include.split('|') : [];

    const allNames: RefIdInfo[] = [];
    const byName: KeyValue<RefIdInfo> = {};
    for (const frame of input) {
      if (frame.refId) {
        let v = byName[frame.refId];
        if (!v) {
          v = byName[frame.refId] = {
            refId: frame.refId,
            count: 0,
          };
          allNames.push(v);
        }
        v.count++;
      }
    }

    if (configuredOptions.length) {
      const options: RefIdInfo[] = [];
      const selected: RefIdInfo[] = [];
      for (const v of allNames) {
        if (configuredOptions.includes(v.refId)) {
          selected.push(v);
        }
        options.push(v);
      }

      this.setState({
        options,
        selected: selected.map((s) => s.refId),
      });
    } else {
      this.setState({ options: allNames, selected: [] });
    }
  }

  onFieldToggle = (fieldName: string) => {
    const { selected } = this.state;
    if (selected.indexOf(fieldName) > -1) {
      this.onChange(selected.filter((s) => s !== fieldName));
    } else {
      this.onChange([...selected, fieldName]);
    }
  };

  onChange = (selected: string[]) => {
    this.setState({ selected });
    this.props.onChange({
      ...this.props.options,
      include: selected.join('|'),
    });
  };

  render() {
    const { options, selected } = this.state;
    const { input } = this.props;
    return (
      <>
        {input.length <= 1 && (
          <div>
            <FieldValidationMessage>Filter data by query expects multiple queries in the input.</FieldValidationMessage>
          </div>
        )}
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label width-8">Series refId</div>
            <HorizontalGroup spacing="xs" align="flex-start" wrap>
              {options.map((o, i) => {
                const label = `${o.refId}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
                const isSelected = selected.indexOf(o.refId) > -1;
                return (
                  <FilterPill
                    key={`${o.refId}/${i}`}
                    onClick={() => {
                      this.onFieldToggle(o.refId);
                    }}
                    label={label}
                    selected={isSelected}
                  />
                );
              })}
            </HorizontalGroup>
          </div>
        </div>
      </>
    );
  }
}

export const filterFramesByRefIdTransformRegistryItem: TransformerRegistryItem<FilterFramesByRefIdTransformerOptions> =
  {
    id: DataTransformerID.filterByRefId,
    editor: FilterByRefIdTransformerEditor,
    transformation: standardTransformers.filterFramesByRefIdTransformer,
    name: 'Filter data by query',
    description:
      'Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel.',
  };
